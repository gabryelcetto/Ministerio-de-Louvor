import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Music, Wand2 } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { FormError } from '@/components/common/form-error';
import { LoadingState } from '@/components/common/states';
import { useUnsavedGuard } from '@/components/common/use-unsaved-guard';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMyPermissions } from '@/features/auth';
import { useSingleFlight } from '@/hooks/use-single-flight';
import {
  convertPastedChords,
  firstChordKey,
  lyricsFromChordPro,
  withDeclaredKey,
} from '@/lib/chords';
import { useSongCategories } from '../api';
import { chordSheetWarnings } from '../editor-checks';
import { isMediaUrl, newSongSchema, useCreateSong } from '../song-data';
import { ChordSheet } from './chord-sheet';
import { KeyOptions, selectClass } from './song-data-fields';

/** O que o app entendeu do texto colado, em linguagem simples. */
const FORMAT_LABEL = {
  chordpro: 'cifra com os acordes entre colchetes',
  'chords-over-lyrics': 'acordes em cima da letra (como nos sites de cifra)',
  'lyrics-only': 'só a letra, sem acordes',
  empty: '',
} as const;

type FormValues = {
  title: string;
  artist: string;
  category: string;
  originalKey: string;
  mediaUrl: string;
  notes: string;
};

/**
 * Nova música (songs.manage), numa tela só e com a cifra primeiro:
 * Título → "Cole a cifra ou a letra" (conversão automática e prévia) → Tom (sugerido pelo
 * primeiro acorde) → "Mais detalhes" (recolhido). Só o título é obrigatório.
 */
export function NewSongPage() {
  const permissions = useMyPermissions();
  const canCreate = permissions.data?.includes('songs.manage') ?? false;
  const canSetKey = permissions.data?.includes('songs.set_official_key') ?? false;

  return (
    <>
      <ScreenHeader title="Nova música" back="/repertorio" />
      {permissions.isPending ? (
        <LoadingState />
      ) : !canCreate ? (
        <p role="alert" className="mx-auto max-w-[45rem] rounded-lg border p-4">
          Você não tem permissão para cadastrar músicas.
        </p>
      ) : (
        <NewSongForm canSetKey={canSetKey} />
      )}
    </>
  );
}

function NewSongForm({ canSetKey }: { canSetKey: boolean }) {
  const id = useId();
  const navigate = useNavigate();
  const categories = useSongCategories();
  const create = useCreateSong();
  const once = useSingleFlight({ keepLockedOnSuccess: true });
  const [pasted, setPasted] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [officialKey, setOfficialKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(newSongSchema),
    defaultValues: {
      title: '',
      artist: '',
      category: '',
      originalKey: '',
      mediaUrl: '',
      notes: '',
    },
  });
  const fields = useWatch({ control });

  const converted = useMemo(() => convertPastedChords(pasted), [pasted]);
  // Tom sugerido pelo primeiro acorde; a pessoa pode trocar (aí vale a escolha dela).
  const suggestedKey = useMemo(
    () => (converted.chordpro ? firstChordKey(converted.chordpro) : null),
    [converted.chordpro],
  );
  const chosenKey = keyTouched ? (fields.originalKey ?? '') : (suggestedKey ?? '');
  const chordpro = converted.chordpro
    ? chosenKey
      ? withDeclaredKey(converted.chordpro, chosenKey)
      : converted.chordpro
    : '';
  const warnings = chordpro
    ? chordSheetWarnings(chordpro).filter((w) => !w.startsWith('Sem {key'))
    : [];
  const lyricsFromSheet = chordpro ? lyricsFromChordPro(chordpro) : '';
  const linkIgnored = Boolean(fields.mediaUrl?.trim()) && !isMediaUrl(fields.mediaUrl ?? '');

  // Algo digitado/colado? Voltar do navegador ou sair pelo menu pede confirmação.
  const typed =
    Object.values(fields).some((v) => typeof v === 'string' && v.trim() !== '') ||
    Boolean(pasted.trim() || lyrics.trim() || officialKey);
  // Salvou: guarda o id e só navega depois (no efeito abaixo), quando o guarda já liberou.
  const [savedId, setSavedId] = useState<string | null>(null);
  const guard = useUnsavedGuard(typed && !savedId);
  useEffect(() => {
    if (savedId) void navigate(`/repertorio/${savedId}`);
  }, [savedId, navigate]);

  const onSubmit = handleSubmit((values) => {
    const finalLyrics =
      lyrics.trim() || (converted.format === 'lyrics-only' ? pasted.trim() : lyricsFromSheet);
    // Duplo toque em "Salvar": o segundo não grava de novo — nem no instante entre salvar e navegar.
    void once(() =>
      create.mutateAsync({
        ...values,
        originalKey: chosenKey,
        officialKey: canSetKey ? officialKey : '',
        lyrics: finalLyrics,
        chords: chordpro,
      }),
    )
      .then((songId) => songId && setSavedId(songId))
      .catch(() => undefined); // o erro aparece pelo create.error
  });

  const textField = (name: 'artist' | 'category' | 'notes', label: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${id}-${name}`}>{label}</Label>
      {name === 'notes' ? (
        <Textarea id={`${id}-${name}`} rows={3} className="text-base" {...register(name)} />
      ) : (
        <Input
          id={`${id}-${name}`}
          className="text-base"
          list={name === 'category' ? `${id}-categorias` : undefined}
          placeholder={name === 'category' ? 'Ex.: Louvor, Adoração, Hino' : undefined}
          {...register(name)}
        />
      )}
    </div>
  );

  return (
    <form noValidate onSubmit={onSubmit} className="mx-auto flex max-w-[45rem] flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-title`}>Título</Label>
        <Input
          id={`${id}-title`}
          className="text-base"
          autoComplete="off"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? `${id}-title-erro` : undefined}
          {...register('title')}
        />
        {errors.title && (
          <p id={`${id}-title-erro`} className="text-sm text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-cifra`}>Cole a cifra ou a letra</Label>
        <Textarea
          id={`${id}-cifra`}
          aria-describedby={`${id}-cifra-dica`}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={12}
          spellCheck={false}
          className="font-mono text-sm"
          placeholder={'G          D\nQuão grande és Tu…'}
        />
        <p id={`${id}-cifra-dica`} className="text-caption text-muted-foreground">
          Do jeito que vem do site ou do caderno: acordes em cima da letra, ou só a letra. Partes
          como [Refrão] e [Intro] G D são reconhecidas.
        </p>
        {converted.format !== 'empty' && (
          <p className="text-sm" aria-live="polite">
            O app entendeu: <strong>{FORMAT_LABEL[converted.format]}</strong>
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
          <section aria-label="Pré-visualização" className="rounded-xl border bg-card p-4">
            <h2 className="section-label mb-2">Como vai ficar</h2>
            <ChordSheet content={chordpro} style={{ fontSize: '17px' }} />
          </section>
        )}
      </div>

      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor={`${id}-tom`}>Tom</Label>
        <select
          id={`${id}-tom`}
          value={chosenKey}
          aria-describedby={`${id}-tom-dica`}
          onChange={(e) => {
            setKeyTouched(true);
            setValue('originalKey', e.target.value, { shouldDirty: true });
          }}
          className={selectClass}
        >
          <option value="">Não sei</option>
          <KeyOptions />
        </select>
        <p id={`${id}-tom-dica`} className="text-caption text-muted-foreground">
          {!keyTouched && suggestedKey
            ? `Sugerido pelo primeiro acorde (${suggestedKey}). Pode trocar.`
            : 'O tom em que a cifra foi escrita.'}
        </p>
      </div>

      <details className="group rounded-xl border bg-card">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-xl px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          Mais detalhes
          <ChevronDown
            aria-hidden="true"
            className="size-5 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="flex flex-col gap-4 border-t p-4">
          {textField('artist', 'Artista / autor')}
          {textField('category', 'Categoria')}
          <datalist id={`${id}-categorias`}>
            {(categories.data ?? []).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-mediaUrl`}>Link de áudio ou vídeo</Label>
            <Input
              id={`${id}-mediaUrl`}
              inputMode="url"
              className="text-base"
              placeholder="https://"
              aria-describedby={linkIgnored ? `${id}-mediaUrl-aviso` : undefined}
              {...register('mediaUrl')}
            />
            {linkIgnored && (
              <p id={`${id}-mediaUrl-aviso`} className="text-caption text-muted-foreground">
                Esse link não começa com https:// e não vai ser salvo.
              </p>
            )}
          </div>
          {textField('notes', 'Observações')}
          {canSetKey && (
            <div className="flex flex-col gap-1.5 sm:max-w-xs">
              <Label htmlFor={`${id}-oficial`}>Tom oficial do ministério</Label>
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
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor={`${id}-letra`}>Letra (se for diferente da cifra)</Label>
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
              rows={6}
              className="text-base"
            />
            <p className="text-caption text-muted-foreground">
              Em branco, a letra sai da própria cifra.
            </p>
          </div>
        </div>
      </details>

      <FormError error={create.error} fallback="Não foi possível cadastrar a música." />
      {/* Espaço para a barra fixa não cobrir o fim do formulário. */}
      <div aria-hidden="true" className="h-20" />
      <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 border-t bg-card px-4 py-3 md:bottom-0 md:left-60 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[45rem]">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={create.isPending || savedId !== null}
          >
            <Music aria-hidden="true" />
            {create.isPending ? 'Salvando…' : 'Salvar música'}
          </Button>
        </div>
      </div>
      {guard}
    </form>
  );
}
