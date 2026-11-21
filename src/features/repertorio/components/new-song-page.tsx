import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Music, Wand2 } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { FormError } from '@/components/common/form-error';
import { LoadingState } from '@/components/common/states';
import { useUnsavedGuard } from '@/components/common/use-unsaved-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMyPermissions } from '@/features/auth';
import { convertPastedChords, guessKey, lyricsFromChordPro, withDeclaredKey } from '@/lib/chords';
import { useSongCategories } from '../api';
import { chordSheetWarnings } from '../editor-checks';
import { songDataSchema, useCreateSong, type SongDataValues } from '../song-data';
import { ChordSheet } from './chord-sheet';
import { KeyOptions, selectClass, SongDataFields } from './song-data-fields';

const FORMAT_LABEL = {
  chordpro: 'ChordPro (acordes entre colchetes)',
  'chords-over-lyrics': 'acordes em cima da letra (formato dos sites de cifra)',
  'lyrics-only': 'sem acordes — será salvo como letra',
  empty: '',
} as const;

/** Nova música (songs.manage): dados + cifra colada (convertida e pré-visualizada) + letra. */
export function NewSongPage() {
  const permissions = useMyPermissions();
  if (permissions.isPending) return <LoadingState />;
  const canCreate = permissions.data?.includes('songs.manage') ?? false;
  const canSetKey = permissions.data?.includes('songs.set_official_key') ?? false;

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link
        to="/repertorio"
        className="inline-flex items-center gap-2 self-start rounded-md px-2 py-1 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Repertório
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Nova música</h1>
        <p className="text-sm text-muted-foreground">
          Cole a cifra como ela vem do site ou do caderno: o app converte, mostra como vai ficar e
          sugere o tom.
        </p>
      </header>
      {canCreate ? (
        <NewSongForm canSetKey={canSetKey} />
      ) : (
        <p role="alert" className="rounded-lg border p-4">
          Você não tem permissão para cadastrar músicas.
        </p>
      )}
    </section>
  );
}

function NewSongForm({ canSetKey }: { canSetKey: boolean }) {
  const id = useId();
  const navigate = useNavigate();
  const categories = useSongCategories();
  const create = useCreateSong();
  const [pasted, setPasted] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [officialKey, setOfficialKey] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<SongDataValues>({
    resolver: zodResolver(songDataSchema),
    defaultValues: {
      title: '',
      artist: '',
      category: '',
      originalKey: '',
      mediaUrl: '',
      notes: '',
    },
  });
  const originalKey = useWatch({ control, name: 'originalKey' });
  // Algo digitado/colado? Voltar do navegador ou sair pelo menu pede confirmação (antes, a cifra
  // colada se perdia sem aviso). Depois de salvar, a ida para a música nova não é bloqueada.
  const fields = useWatch({ control });
  const typed =
    Object.values(fields).some((v) => typeof v === 'string' && v.trim() !== '') ||
    Boolean(pasted.trim() || lyrics.trim() || officialKey);
  // Salvou: guarda o id e só navega depois (no efeito abaixo), quando o guarda já liberou.
  const [savedId, setSavedId] = useState<string | null>(null);
  const guard = useUnsavedGuard(typed && !savedId);
  useEffect(() => {
    if (savedId) void navigate(`/repertorio/${savedId}`);
  }, [savedId, navigate]);

  const converted = useMemo(() => convertPastedChords(pasted), [pasted]);
  const detectedKey = useMemo(
    () => (converted.chordpro ? guessKey(converted.chordpro) : null),
    [converted.chordpro],
  );
  // Cifra final: com {key} do tom original (o seletor de tom da música usa essa referência).
  const keyForSheet = originalKey || detectedKey;
  const chordpro = converted.chordpro
    ? keyForSheet
      ? withDeclaredKey(converted.chordpro, keyForSheet)
      : converted.chordpro
    : '';
  const warnings = chordpro
    ? chordSheetWarnings(chordpro).filter((w) => !w.startsWith('Sem {key'))
    : [];
  const lyricsFromSheet = chordpro ? lyricsFromChordPro(chordpro) : '';

  const onSubmit = handleSubmit((values) => {
    const finalLyrics =
      lyrics.trim() || (converted.format === 'lyrics-only' ? pasted.trim() : lyricsFromSheet);
    create.mutate(
      {
        ...values,
        originalKey: values.originalKey || detectedKey || '',
        officialKey: canSetKey ? officialKey : '',
        lyrics: finalLyrics,
        chords: chordpro,
      },
      { onSuccess: (songId) => setSavedId(songId) },
    );
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <SongDataFields
            register={register}
            errors={errors}
            categories={categories.data ?? []}
            keyHint={
              detectedKey &&
              detectedKey !== originalKey && (
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  Tom detectado na cifra: <strong className="text-foreground">{detectedKey}</strong>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => setValue('originalKey', detectedKey, { shouldDirty: true })}
                  >
                    usar
                  </Button>
                </p>
              )
            }
          />
          {canSetKey && (
            <div className="flex flex-col gap-1.5 sm:max-w-xs">
              <Label htmlFor={`${id}-oficial`}>Tom oficial do ministério (opcional)</Label>
              <select
                id={`${id}-oficial`}
                value={officialKey}
                onChange={(e) => setOfficialKey(e.target.value)}
                className={selectClass}
              >
                <option value="">Ainda não definido</option>
                <KeyOptions />
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-5">
          <Label htmlFor={`${id}-cifra`} className="text-base">
            Cifra (opcional)
          </Label>
          <p id={`${id}-cifra-dica`} className="text-sm text-muted-foreground">
            Cole com os acordes em cima da letra (como nos sites de cifra) ou em ChordPro (
            <code>[G]Santo</code>). Partes como <code>[Refrão]</code> e <code>[Intro] G D</code> são
            reconhecidas.
          </p>
          <Textarea
            id={`${id}-cifra`}
            aria-describedby={`${id}-cifra-dica`}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={10}
            spellCheck={false}
            className="font-mono text-sm"
          />
          {converted.format !== 'empty' && (
            <p className="text-sm" aria-live="polite">
              Formato detectado: <strong>{FORMAT_LABEL[converted.format]}</strong>
            </p>
          )}
          {warnings.length > 0 && (
            <ul aria-label="Avisos da cifra" className="list-disc pl-5 text-sm text-destructive">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {chordpro && (
            <section aria-label="Pré-visualização" className="rounded-lg border bg-muted/40 p-3">
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Pré-visualização</h2>
              <ChordSheet content={chordpro} className="text-base" />
            </section>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor={`${id}-letra`} className="text-base">
              Letra (opcional)
            </Label>
            {lyricsFromSheet && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLyrics(lyricsFromSheet)}
              >
                <Wand2 aria-hidden="true" />
                Gerar letra a partir da cifra
              </Button>
            )}
          </div>
          <Textarea
            id={`${id}-letra`}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={8}
            className="text-base"
          />
          {!lyrics.trim() && lyricsFromSheet && (
            <p className="text-sm text-muted-foreground">
              Se ficar vazia, a letra será gerada a partir da cifra.
            </p>
          )}
        </CardContent>
      </Card>

      <FormError error={create.error} fallback="Não foi possível cadastrar a música." />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={create.isPending}>
          <Music aria-hidden="true" />
          {create.isPending ? 'Salvando…' : 'Salvar música'}
        </Button>
        <Button type="button" variant="outline" size="lg" asChild>
          <Link to="/repertorio">Cancelar</Link>
        </Button>
      </div>
      {guard}
    </form>
  );
}
