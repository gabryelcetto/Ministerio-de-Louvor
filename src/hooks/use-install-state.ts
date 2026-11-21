import { useSyncExternalStore } from 'react';
import { getInstallState, subscribeInstallState, type InstallState } from '@/lib/install';

/** Estado da instalação do PWA (atualiza quando o navegador oferece ou conclui a instalação). */
export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribeInstallState, getInstallState);
}
