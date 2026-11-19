import { useEffect } from 'react';
import { useBlocker } from 'react-router';
import { ConfirmDialog } from './confirm-dialog';

/**
 * Enquanto `dirty`, impede sair da tela sem querer: navegação interna abre uma confirmação e
 * fechar/recarregar a aba usa o aviso do próprio navegador.
 */
export function useUnsavedGuard(dirty: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const dialog = (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title="Sair sem salvar?"
      confirmLabel="Sair sem salvar"
      cancelLabel="Continuar editando"
      destructive
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    >
      As alterações feitas aqui serão perdidas.
    </ConfirmDialog>
  );
  return dialog;
}
