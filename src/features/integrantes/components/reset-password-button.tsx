import { Check, KeyRound } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormError } from '@/components/common/form-error';
import { Button } from '@/components/ui/button';
import { buildResetMessage, useResetPassword, type ResetResult } from '../reset';
import { TemporaryPasswordPanel } from './temporary-password';

/**
 * "Redefinir senha" de um integrante: confirma, chama a Edge Function e mostra a senha
 * provisória uma única vez. Só aparece para quem pode (canResetPassword); o banco decide.
 */
export function ResetPasswordButton({ memberId, name }: { memberId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);
  const reset = useResetPassword();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => {
          reset.reset();
          setConfirming(true);
        }}
      >
        <KeyRound aria-hidden="true" />
        Redefinir senha
        <span className="sr-only"> de {name}</span>
      </Button>

      <ConfirmDialog
        open={confirming}
        title={`Redefinir a senha de ${name}?`}
        confirmLabel="Redefinir senha"
        destructive
        busy={reset.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          reset.mutate(memberId, {
            onSuccess: (data) => {
              setConfirming(false);
              setResult(data);
            },
          })
        }
      >
        <div className="flex flex-col gap-2">
          <p>
            A senha atual deixa de funcionar. O app gera uma senha provisória para você enviar, e a
            pessoa cria uma senha nova no próximo acesso.
          </p>
          <FormError error={reset.error} />
        </div>
      </ConfirmDialog>

      {result && <ResetResultDialog result={result} onClose={() => setResult(null)} />}
    </>
  );
}

function ResetResultDialog({ result, onClose }: { result: ResetResult; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const message = buildResetMessage({ ...result, appUrl: window.location.origin });

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100%-2rem))] overflow-y-auto rounded-xl border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-overlay"
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 id={titleId} className="flex items-center gap-2 text-lg font-semibold">
          <Check aria-hidden="true" className="size-5 text-primary" />
          Senha de {result.fullName} redefinida
        </h2>
        <TemporaryPasswordPanel
          email={result.email}
          temporaryPassword={result.temporaryPassword}
          message={message}
        />
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </dialog>
  );
}
