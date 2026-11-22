import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** O aparelho está com internet? (segue os eventos online/offline do navegador). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine !== false,
    () => true,
  );
}

/** Explicação padrão para o que precisa de internet (editar, enviar arquivos). */
export const NEEDS_INTERNET = 'Precisa de internet. Conecte-se para editar ou enviar arquivos.';
