/**
 * Navegação do app (sem React): o que vai na barra de baixo (celular), na lateral (computador)
 * e quais telas são "principais" (topo com a chama e o sino) ou "internas" (voltar + título).
 */

/** Os 5 itens da barra de baixo, na ordem (também abrem a lateral no computador). */
export const PRIMARY_PATHS = ['/', '/escalas', '/repertorio', '/agenda', '/mais'] as const;
/** Atalhos extras só da lateral do computador. */
export const DESKTOP_EXTRA_PATHS = ['/integrantes', '/comunicados', '/configuracoes'] as const;
/**
 * Telas que se abrem pela tela "Mais": com elas abertas, o item "Mais" fica marcado.
 * (Integrantes, Comunicados e Configurações também aparecem na lateral do computador.)
 */
export const MORE_SECTION_PATHS = [
  '/mais',
  '/integrantes',
  '/comunicados',
  '/configuracoes',
  '/instalar',
  '/atividade',
] as const;

/** O caminho atual pertence ao item? ("/" só na raiz; "/repertorio/123" ativa "/repertorio"). */
export function isPathActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Item da barra de baixo que fica marcado nesta tela (ou null). */
export function activePrimary(pathname: string): (typeof PRIMARY_PATHS)[number] | null {
  if (MORE_SECTION_PATHS.some((p) => isPathActive(pathname, p))) return '/mais';
  return PRIMARY_PATHS.find((p) => p !== '/mais' && isPathActive(pathname, p)) ?? null;
}

/**
 * Tela principal (topo com a chama, "Louvor ADVOP" e o sino)? As demais são internas e
 * desenham o próprio cabeçalho com voltar + título.
 */
export function isMainScreen(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return (PRIMARY_PATHS as readonly string[]).includes(clean);
}
