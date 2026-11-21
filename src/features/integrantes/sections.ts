/**
 * Grupos do ministério: cantores (funções "vocal") e instrumentistas ("instrumental").
 * Servem só para selos e filtros — NÃO dão permissão nenhuma.
 */
export type Section = 'vocal' | 'instrumental';
export type SectionFilter = 'todos' | Section;

export const SECTION_BADGE: Record<Section, string> = {
  vocal: 'Cantor(a)',
  instrumental: 'Instrumentista',
};

export const SECTION_FILTER_LABEL: Record<SectionFilter, string> = {
  todos: 'Todos',
  vocal: 'Cantores',
  instrumental: 'Instrumentistas',
};

/** Grupos de uma pessoa a partir das funções dela, sem repetir, cantores primeiro. */
export function sectionsOf(functions: readonly { section: string }[]): Section[] {
  const set = new Set(functions.map((f) => f.section));
  return (['vocal', 'instrumental'] as const).filter((s) => set.has(s));
}

/** A pessoa (pelas funções) entra no filtro? "todos" sempre; sem função só em "todos". */
export function matchesSection(
  functionIds: readonly number[],
  functions: readonly { id: number; section: string }[],
  filter: SectionFilter,
): boolean {
  if (filter === 'todos') return true;
  return functions.some((f) => f.section === filter && functionIds.includes(f.id));
}
