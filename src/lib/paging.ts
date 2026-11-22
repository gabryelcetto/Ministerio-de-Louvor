/**
 * "Carregar mais" (useInfiniteQuery com range): páginas de PAGE_SIZE itens; a próxima começa
 * onde a anterior parou. Página incompleta = acabou.
 */
export const PAGE_SIZE = 30;

/** Intervalo do PostgREST (range é inclusivo) para a página que começa em `offset`. */
export function pageRange(offset: number, size = PAGE_SIZE): [number, number] {
  return [offset, offset + size - 1];
}

/** Próximo offset, ou undefined quando não há mais. */
export function nextOffset<T>(
  lastPage: readonly T[],
  allPages: readonly (readonly T[])[],
  size = PAGE_SIZE,
): number | undefined {
  if (lastPage.length < size) return undefined;
  return allPages.reduce((total, page) => total + page.length, 0);
}
