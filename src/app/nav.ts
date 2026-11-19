export type NavPlacement = 'bar' | 'more';

/** O caminho atual pertence ao item? ("/" só na raiz; "/repertorio/123" ativa "/repertorio"). */
export function isPathActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Separa os itens da barra inferior (no máximo 4 + "Mais") dos que vão para o menu "Mais". */
export function splitMobileNav<T extends { mobile: NavPlacement }>(
  items: readonly T[],
  maxBar = 4,
): { bar: T[]; more: T[] } {
  const bar = items.filter((i) => i.mobile === 'bar');
  const overflow = bar.slice(maxBar);
  return {
    bar: bar.slice(0, maxBar),
    more: [...overflow, ...items.filter((i) => i.mobile === 'more')],
  };
}
