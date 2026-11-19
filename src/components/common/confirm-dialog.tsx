import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Confirmação com <dialog> nativo: prende o foco, Esc cancela e o foco volta para quem abriu.
 * Controlado por `open`; o foco inicial fica em "Cancelar" (a ação segura).
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={children ? descId : undefined}
      // Esc dispara "cancel": avisamos o pai em vez de deixar o navegador fechar sozinho.
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-overlay"
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        {children && (
          <div id={descId} className="text-sm text-muted-foreground">
            {children}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {/* type="button": o diálogo pode estar dentro de um <form> e não deve enviá-lo. */}
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy} autoFocus>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Aguarde…' : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
