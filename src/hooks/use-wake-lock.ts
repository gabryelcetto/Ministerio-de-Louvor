import { useEffect } from 'react';

interface WakeLockSentinelLike {
  release(): Promise<void>;
}
type WakeLockNavigator = Navigator & {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
};

/**
 * Mantém a tela ligada enquanto `active` (modo tocar da música), quando o aparelho deixa
 * (Wake Lock API: Chrome/Android e Safari a partir do iOS 16.4). O navegador solta a trava
 * quando a aba sai de foco; ao voltar, pede de novo. Sem suporte, não faz nada.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (!active || !wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const next = await wakeLock.request('screen');
        if (cancelled) void next.release().catch(() => undefined);
        else sentinel = next;
      } catch {
        // Sem permissão / economia de bateria: a tela segue a regra do aparelho.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}
