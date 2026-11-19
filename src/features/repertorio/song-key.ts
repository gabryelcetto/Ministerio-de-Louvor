import {
  allKeys,
  getDeclaredKey,
  normalizeKey,
  parseKey,
  semitonesBetween,
  transposeKey,
} from '@/lib/chords';

/**
 * Transposição na tela da música. O estado é sempre "quantos semitons em relação ao tom em que
 * a cifra foi escrita" (o tom-base). O tom mostrado ao músico é derivado disso.
 */

/** Deixa os semitons entre -5 e +6: o caminho mais curto (+7 vira -5). */
export function normalizeSemitones(semitones: number): number {
  const mod = ((Math.round(semitones) % 12) + 12) % 12;
  return mod > 6 ? mod - 12 : mod;
}

/** Tom em que a cifra está escrita: {key: X} da cifra, senão o tom original cadastrado. */
export function sheetBaseKey(
  chordsContent: string | null,
  originalKey: string | null,
): string | null {
  const declared = chordsContent ? getDeclaredKey(chordsContent) : null;
  const candidate = declared ?? originalKey;
  return candidate && parseKey(candidate) ? normalizeKey(candidate) : null;
}

/** Tom atual (grafia padrão) ou null se o tom-base é desconhecido. */
export function currentKey(baseKey: string | null, semitones: number): string | null {
  return baseKey ? transposeKey(baseKey, semitones) : null;
}

/** Semitons para sair do tom-base e chegar a `target` (0 se algum tom for inválido). */
export function semitonesTo(baseKey: string | null, target: string | null): number {
  if (!baseKey || !target || !parseKey(target)) return 0;
  return normalizeSemitones(semitonesBetween(baseKey, target));
}

/** Os 12 tons do seletor, no mesmo modo (maior/menor) do tom-base. */
export function keyOptions(baseKey: string | null): string[] {
  const minor = baseKey ? (parseKey(baseKey)?.minor ?? false) : false;
  return allKeys(minor);
}

/** "+2", "-3" ou "original" — para quando o tom-base é desconhecido. */
export function formatSemitones(semitones: number): string {
  if (semitones === 0) return 'original';
  return semitones > 0 ? `+${semitones}` : `${semitones}`;
}

/** Só aceita links http(s): evita `javascript:` e afins vindos do banco. */
export function safeMediaUrl(url: string | null): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Nome amigável do site do link de mídia ("youtube.com"). */
export function mediaHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Categorias distintas, em ordem alfabética (pt-BR), sem vazias. */
export function uniqueCategories(values: readonly (string | null)[]): string[] {
  const set = new Set(values.map((v) => v?.trim()).filter((v): v is string => Boolean(v)));
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
