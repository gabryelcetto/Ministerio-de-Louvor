import { Wand2 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormError } from '@/components/common/form-error';
import { useUnsavedGuard } from '@/components/common/use-unsaved-guard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { allKeys, chordsOverLyricsToChordPro } from '@/lib/chords';
import { cn } from '@/lib/utils';
import { useSaveChords, useSaveLyrics, useSetOfficialKey } from '../editing';
import { chordSheetWarnings } from '../editor-checks';
import { ChordSheet } from './chord-sheet';

interface EditorProps {
  songId: string;
  initial: string;
  /** Fecha o editor; `saved` = true quando gravou no banco. */
  onDone: (saved: boolean) => void;
}

/** Salvar/Cancelar com confirmação ao descartar alterações. */
function EditorActions({
  dirty,
  saving,
  onCancel,
  saveLabel,
}: {
  dirty: boolean;
  saving: boolean;
  onCancel: () => void;
  saveLabel: string;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={saving}
        onClick={() => (dirty ? setConfirming(true) : onCancel())}
      >
        Cancelar
      </Button>
      {/* Salvar envia o <form> (Enter no campo também não salva: textarea quebra linha). */}
      <Button type="submit" disabled={!dirty || saving}>
        {saving ? 'Salvando…' : saveLabel}
      </Button>
      <ConfirmDialog
        open={confirming}
        title="Descartar alterações?"
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        destructive
        onConfirm={() => {
          setConfirming(false);
          onCancel();
        }}
        onCancel={() => setConfirming(false)}
      >
        O que você mudou ainda não foi salvo.
      </ConfirmDialog>
    </div>
  );
}

/** Letra: qualquer integrante ativo pode editar. */
export function LyricsEditor({ songId, initial, onDone }: EditorProps) {
  const id = useId();
  const [value, setValue] = useState(initial);
  const save = useSaveLyrics(songId);
  const dirty = value !== initial;
  const guard = useUnsavedGuard(dirty && !save.isSuccess);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(value, { onSuccess: () => onDone(true) });
      }}
    >
      <Label htmlFor={id}>Letra</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={14}
        className="text-lg leading-relaxed"
        autoFocus
      />
      <FormError error={save.error} fallback="Não foi possível salvar a letra." />
      <EditorActions
        dirty={dirty}
        saving={save.isPending}
        onCancel={() => onDone(false)}
        saveLabel="Salvar letra"
      />
      {guard}
    </form>
  );
}

/** Cifra em ChordPro com pré-visualização. Só aparece para quem tem chords.edit_official. */
export function ChordsEditor({ songId, initial, onDone }: EditorProps) {
  const id = useId();
  const helpId = useId();
  const [value, setValue] = useState(initial);
  const [view, setView] = useState<'editar' | 'previa'>('editar');
  const save = useSaveChords(songId);
  const dirty = value !== initial;
  const guard = useUnsavedGuard(dirty && !save.isSuccess);
  const warnings = chordSheetWarnings(value);
  const submit = () => save.mutate(value, { onSuccess: () => onDone(true) });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {/* No celular, alterna entre editar e pré-visualizar; no computador, lado a lado. */}
      <div
        role="group"
        aria-label="Modo"
        className="grid grid-cols-2 rounded-lg bg-muted p-1 lg:hidden"
      >
        {(['editar', 'previa'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={view === mode}
            onClick={() => setView(mode)}
            className={cn(
              'min-h-10 rounded-md text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              view === mode ? 'bg-card shadow-sm' : 'text-muted-foreground',
            )}
          >
            {mode === 'editar' ? 'Editar' : 'Pré-visualizar'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={cn('flex flex-col gap-2', view === 'previa' && 'hidden lg:flex')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor={id}>Cifra (ChordPro)</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setValue(chordsOverLyricsToChordPro(value))}
              title="Converte o formato de sites (acordes numa linha, letra na de baixo)"
            >
              <Wand2 aria-hidden="true" />
              Converter acordes sobre a letra
            </Button>
          </div>
          <Textarea
            id={id}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={18}
            spellCheck={false}
            aria-describedby={helpId}
            className="font-mono text-sm leading-relaxed"
            autoFocus
          />
          <p id={helpId} className="text-xs text-muted-foreground">
            Acorde entre colchetes antes da sílaba: <code>[G]Santo, [D]santo</code>. Tom:{' '}
            <code>{'{key: G}'}</code>. Seção: <code>{'{c: Refrão}'}</code>.
          </p>
        </div>

        <section
          aria-label="Pré-visualização"
          className={cn(
            'flex flex-col gap-2 rounded-lg border p-4',
            view === 'editar' && 'hidden lg:flex',
          )}
        >
          <h3 className="text-sm font-semibold text-muted-foreground">Pré-visualização</h3>
          {value.trim() ? (
            <ChordSheet content={value} className="text-lg" />
          ) : (
            <p className="text-sm text-muted-foreground">A cifra aparece aqui.</p>
          )}
        </section>
      </div>

      {warnings.length > 0 && (
        <ul
          aria-label="Avisos da cifra"
          className="flex flex-col gap-1 rounded-lg border border-accent bg-accent/10 p-3 text-sm"
        >
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <FormError error={save.error} fallback="Não foi possível salvar a cifra." />
      <EditorActions
        dirty={dirty}
        saving={save.isPending}
        onCancel={() => onDone(false)}
        saveLabel="Salvar cifra"
      />
      {guard}
    </form>
  );
}

/** Tom oficial: só para quem tem songs.set_official_key. */
export function OfficialKeyEditor({
  songId,
  current,
  shownKey,
  onDone,
}: {
  songId: string;
  current: string | null;
  /** Tom que está na tela agora (atalho "usar este"). */
  shownKey: string | null;
  onDone: (saved: boolean) => void;
}) {
  const id = useId();
  const [value, setValue] = useState(current ?? '');
  const save = useSetOfficialKey(songId);
  const next = value || null;

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(next, { onSuccess: () => onDone(true) });
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id}>Tom oficial</Label>
          <select
            id={id}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-11 min-w-40 rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Sem tom oficial</option>
            <KeyGroup label="Maiores" keys={allKeys(false)} />
            <KeyGroup label="Menores" keys={allKeys(true)} />
          </select>
        </div>
        {shownKey && shownKey !== value && (
          <Button type="button" variant="ghost" onClick={() => setValue(shownKey)}>
            Usar o tom da tela ({shownKey})
          </Button>
        )}
      </div>
      <FormError error={save.error} fallback="Não foi possível salvar o tom oficial." />
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onDone(false)}
          disabled={save.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={next === current || save.isPending}>
          {save.isPending ? 'Salvando…' : 'Salvar tom oficial'}
        </Button>
      </div>
    </form>
  );
}

function KeyGroup({ label, keys }: { label: string; keys: string[] }): ReactNode {
  return (
    <optgroup label={label}>
      {keys.map((k) => (
        <option key={k} value={k}>
          {k}
        </option>
      ))}
    </optgroup>
  );
}
