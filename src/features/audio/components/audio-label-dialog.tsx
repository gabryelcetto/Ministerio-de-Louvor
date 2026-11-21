import { useEffect, useId, useRef, useState } from 'react';
import { FormError } from '@/components/common/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LABEL_MAX, LABEL_SUGGESTIONS, labelProblem, normalizeLabel } from '../api';

/**
 * Nome do áudio ("Voz guia", "Arranjo", "Ensaio"…): pedido logo depois de enviar e editável
 * depois pelo autor ou admin. Vazio = sem nome (a lista mostra "Áudio N" / "Gravação N").
 */
export function AudioLabelDialog({
  isNew,
  initial,
  busy,
  error,
  onSave,
  onCancel,
}: {
  /** true logo depois de enviar ("Agora não"); false ao renomear ("Cancelar"). */
  isNew: boolean;
  initial: string | null;
  busy: boolean;
  error: unknown;
  onSave: (label: string | null) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [value, setValue] = useState(initial ?? '');
  const problem = labelProblem(value);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-overlay"
    >
      <form
        noValidate
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!problem) onSave(normalizeLabel(value));
        }}
      >
        <h2 id={`${id}-titulo`} className="text-lg font-semibold">
          {isNew ? 'Dê um nome a este áudio' : 'Renomear áudio'}
        </h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-nome`}>Nome do áudio</Label>
          <Input
            id={`${id}-nome`}
            value={value}
            maxLength={LABEL_MAX + 10}
            autoComplete="off"
            placeholder="Ex.: Voz guia"
            aria-invalid={Boolean(problem)}
            aria-describedby={problem ? `${id}-erro` : `${id}-dica`}
            className="h-11 text-base"
            onChange={(e) => setValue(e.target.value)}
          />
          {problem ? (
            <p id={`${id}-erro`} className="text-sm text-destructive">
              {problem}
            </p>
          ) : (
            <p id={`${id}-dica`} className="text-xs text-muted-foreground">
              Opcional, até {LABEL_MAX} caracteres. Deixe em branco para ficar sem nome.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sugestões de nome">
          {LABEL_SUGGESTIONS.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setValue(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
        <FormError error={error} fallback="Não foi possível salvar o nome." />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {isNew ? 'Agora não' : 'Cancelar'}
          </Button>
          <Button type="submit" disabled={busy || Boolean(problem)}>
            {busy ? 'Salvando…' : 'Salvar nome'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
