/** Texto para comparar em buscas: sem acento, minúsculo e sem espaços nas pontas. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
