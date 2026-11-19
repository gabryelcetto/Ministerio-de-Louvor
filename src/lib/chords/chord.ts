/**
 * Acordes: reconhecimento (inclusive notação brasileira) e transposição.
 * Exemplos aceitos: G, Am, F#m7, Bb7(9), C7M, Dm7(b5), Bm7b5, B°, Gº, Esus4, Cadd9,
 * D/F#, A/C#, G7(#11), C6(9), Ebmaj7, F+, Caug, Cdim, D4, A2.
 */
import { NOTE_RE_SOURCE, transposeNote } from './notes';

export interface Chord {
  root: string;
  /** Tudo que vem depois da tônica e antes do baixo: "m7(b5)", "7M", "sus4"... */
  suffix: string;
  bass: string | null;
}

/** Pedaços válidos de um sufixo, em qualquer ordem (cobre cifra brasileira e americana). */
const SUFFIX_TOKEN =
  'maj|min|dim|aug|sus|add|m|M|°|º|ø|\\+|-|[#b]?\\d{1,2}|\\((?:[#b+-]?\\d{1,2}M?)(?:[,/][#b+-]?\\d{1,2}M?)*\\)';
const CHORD_RE = new RegExp(`^(${NOTE_RE_SOURCE})((?:${SUFFIX_TOKEN})*)(?:/(${NOTE_RE_SOURCE}))?$`);

export function parseChord(text: string): Chord | null {
  const match = CHORD_RE.exec(text.trim());
  if (!match || !match[1]) return null;
  return { root: match[1], suffix: match[2] ?? '', bass: match[3] ?? null };
}

export function isChord(text: string): boolean {
  return parseChord(text) !== null;
}

export function formatChord(chord: Chord): string {
  return `${chord.root}${chord.suffix}${chord.bass ? `/${chord.bass}` : ''}`;
}

/**
 * Transpõe um acorde. Texto que não é acorde (ex.: "N.C.", "x2") volta igual.
 * O sufixo (7M, m7(b5), sus4...) é preservado; tônica e baixo mudam.
 */
export function transposeChord(text: string, semitones: number, preferFlats: boolean): string {
  const chord = parseChord(text);
  if (!chord) return text;
  return formatChord({
    root: transposeNote(chord.root, semitones, preferFlats),
    suffix: chord.suffix,
    bass: chord.bass ? transposeNote(chord.bass, semitones, preferFlats) : null,
  });
}
