/**
 * Notas, tons e escolha de sustenido/bemol. Puro TypeScript, sem React.
 */

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/** Nome "de partitura" mais comum para cada tom (índice = classe de altura 0–11). */
const MAJOR_KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const MINOR_KEY_NAMES = [
  'Cm',
  'C#m',
  'Dm',
  'Ebm',
  'Em',
  'Fm',
  'F#m',
  'Gm',
  'G#m',
  'Am',
  'Bbm',
  'Bm',
] as const;

/** Tons sem "b" no nome que mesmo assim usam bemóis na armadura. */
const FLAT_KEYS_WITHOUT_B = new Set(['F', 'Dm', 'Gm', 'Cm', 'Fm']);

const NATURAL: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const NOTE_RE_SOURCE = '[A-G](?:#|b)?';

/** Classe de altura (0–11) de uma nota como "C#", "Db", "E#", "Cb". */
export function noteToPitch(note: string): number {
  const base = NATURAL[note.charAt(0)];
  if (base === undefined) throw new Error(`Nota inválida: ${note}`);
  const accidental = note.slice(1);
  if (accidental === '') return base;
  if (accidental === '#') return (base + 1) % 12;
  if (accidental === 'b') return (base + 11) % 12;
  throw new Error(`Nota inválida: ${note}`);
}

export function pitchToNote(pitch: number, preferFlats: boolean): string {
  const index = ((pitch % 12) + 12) % 12;
  return (preferFlats ? FLATS : SHARPS)[index] as string;
}

export function transposeNote(note: string, semitones: number, preferFlats: boolean): string {
  return pitchToNote(noteToPitch(note) + semitones, preferFlats);
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/**
 * Grau (0 = tônica … 6 = sétimo) usado para escrever cada distância em semitons a partir da
 * tônica: 1, b2, 2, b3, 3, 4, #4, 5, b6, 6, b7, 7. É a grafia convencional das notas cromáticas
 * (em G: Bb, Eb, F, C#), e vale para tons maiores e menores (em Am: C, C#, F, G#).
 */
const DEGREE_FOR_INTERVAL = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6] as const;

/**
 * Nome da nota `pitch` escrito dentro do tom `key`: a letra vem do grau e o acidente da
 * diferença para a letra natural. Ex.: em G, a classe 10 é "Bb" (b3), não "A#".
 * Se o resultado exigir dobrado sustenido/bemol, cai na grafia simples do tom.
 */
export function spellPitchInKey(pitch: number, key: string): string {
  const parsed = parseKey(key);
  if (!parsed) return pitchToNote(pitch, false);
  const tonicName = keyName(parsed.pitch, parsed.minor).replace(/m$/, '');
  const tonicLetter = LETTERS.indexOf(tonicName.charAt(0) as (typeof LETTERS)[number]);
  const interval = (((pitch - parsed.pitch) % 12) + 12) % 12;
  const letter = LETTERS[(tonicLetter + DEGREE_FOR_INTERVAL[interval]!) % 7] as string;
  const target = ((pitch % 12) + 12) % 12;
  // Diferença entre a nota pedida e a letra natural, entre -6 e +5.
  const diff = ((((target - (NATURAL[letter] as number)) % 12) + 18) % 12) - 6;
  if (diff === 0) return letter;
  if (diff === 1) return `${letter}#`;
  if (diff === -1) return `${letter}b`;
  return pitchToNote(target, keyPrefersFlats(key));
}

export interface ParsedKey {
  pitch: number;
  minor: boolean;
}

/** Interpreta um tom: "G", "Bb", "F#m", "Ebm". Retorna null se não for um tom válido. */
export function parseKey(key: string): ParsedKey | null {
  const match = new RegExp(`^(${NOTE_RE_SOURCE})(m)?$`).exec(key.trim());
  if (!match || !match[1]) return null;
  return { pitch: noteToPitch(match[1]), minor: match[2] === 'm' };
}

/** Nome padrão do tom para uma classe de altura (ex.: 10 maior → "Bb"). */
export function keyName(pitch: number, minor: boolean): string {
  const index = ((pitch % 12) + 12) % 12;
  return (minor ? MINOR_KEY_NAMES : MAJOR_KEY_NAMES)[index] as string;
}

/** Normaliza a grafia do tom: "A#" → "Bb", "Gb" → "F#", "D#m" → "Ebm". */
export function normalizeKey(key: string): string | null {
  const parsed = parseKey(key);
  return parsed ? keyName(parsed.pitch, parsed.minor) : null;
}

/** O tom usa bemóis? Decide como escrever os acordes transpostos. */
export function keyPrefersFlats(key: string): boolean {
  const name = normalizeKey(key);
  if (!name) return false;
  return name.slice(1).startsWith('b') || FLAT_KEYS_WITHOUT_B.has(name);
}

/** Quantos semitons (0–11) para ir de um tom ao outro. */
export function semitonesBetween(fromKey: string, toKey: string): number {
  const from = parseKey(fromKey);
  const to = parseKey(toKey);
  if (!from || !to) throw new Error(`Tom inválido: ${!from ? fromKey : toKey}`);
  return (((to.pitch - from.pitch) % 12) + 12) % 12;
}

/** Tom resultante de transpor `key` por `semitones`, com a grafia padrão. */
export function transposeKey(key: string, semitones: number): string {
  const parsed = parseKey(key);
  if (!parsed) throw new Error(`Tom inválido: ${key}`);
  return keyName(parsed.pitch + semitones, parsed.minor);
}

/** Lista dos 12 tons (maiores ou menores) para o seletor de tom. */
export function allKeys(minor: boolean): string[] {
  return [...(minor ? MINOR_KEY_NAMES : MAJOR_KEY_NAMES)];
}
