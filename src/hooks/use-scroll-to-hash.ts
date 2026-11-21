import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * Rola até o trecho indicado no endereço (ex.: /configuracoes#aparencia, vindo da tela Mais).
 * O React Router não faz isso sozinho.
 */
export function useScrollToHash() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' });
  }, [hash]);
}
