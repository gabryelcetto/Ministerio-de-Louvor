/**
 * Parser e transposição de ChordPro: "[G]Amazing [G7]grace" + diretivas "{key: G}".
 */
import { transposeChord } from './chord';
import { keyPrefersFlats, parseKey, semitonesBetween, transposeKey } from './notes';

export interface Segment {
  /** Acorde que fica sobre o início de `text` (null = só texto). */
  chord: string | null;
  text: string;
}

export type SheetLine =
  | { type: 'lyrics'; segments: Segment[] }
  | { type: 'directive'; name: string; value: string }
  | { type: 'comment'; text: string }
  | { type: 'empty' };

const DIRECTIVE_RE = /^\{\s*([a-zA-Z_]+)\s*(?::\s*(.*?))?\s*\}$/;
const CHORD_TOKEN_RE = /\[([^\]]*)\]/g;

export function parseLine(line: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let pendingChord: string | null = null;
  for (const match of line.matchAll(CHORD_TOKEN_RE)) {
    const index = match.index ?? 0;
    const text = line.slice(lastIndex, index);
    if (text !== '' || pendingChord !== null) segments.push({ chord: pendingChord, text });
    pendingChord = (match[1] ?? '').trim();
    lastIndex = index + match[0].length;
  }
  const rest = line.slice(lastIndex);
  if (rest !== '' || pendingChord !== null) segments.push({ chord: pendingChord, text: rest });
  return segments;
}

export function parseChordPro(content: string): SheetLine[] {
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((raw): SheetLine => {
      const line = raw.trimEnd();
      if (line.trim() === '') return { type: 'empty' };
      const directive = DIRECTIVE_RE.exec(line.trim());
      if (directive && directive[1]) {
        const name = directive[1].toLowerCase();
        const value = directive[2] ?? '';
        if (name === 'c' || name === 'comment' || name === 'ci')
          return { type: 'comment', text: value };
        return { type: 'directive', name, value };
      }
      return { type: 'lyrics', segments: parseLine(line) };
    });
}

/** Lê o tom declarado em {key: X}, se houver. */
export function getDeclaredKey(content: string): string | null {
  for (const line of parseChordPro(content)) {
    if (line.type === 'directive' && line.name === 'key' && parseKey(line.value)) return line.value;
  }
  return null;
}

/** Lista os acordes usados, sem repetir, na ordem em que aparecem. */
export function extractChords(content: string): string[] {
  const seen = new Set<string>();
  for (const match of content.matchAll(CHORD_TOKEN_RE)) {
    const chord = (match[1] ?? '').trim();
    if (chord) seen.add(chord);
  }
  return [...seen];
}

export interface TransposeOptions {
  /** Tom atual da música; se omitido, usa {key: X} do conteúdo. */
  fromKey?: string | null;
  /** Força sustenido/bemol; se omitido, decide pelo tom de destino. */
  preferFlats?: boolean;
}

/** Transpõe por semitons (positivo sobe, negativo desce). Atualiza {key: X}. */
export function transposeChordPro(
  content: string,
  semitones: number,
  options: TransposeOptions = {},
): string {
  const fromKey = options.fromKey ?? getDeclaredKey(content);
  const targetKey = fromKey && parseKey(fromKey) ? transposeKey(fromKey, semitones) : null;
  const preferFlats = options.preferFlats ?? (targetKey ? keyPrefersFlats(targetKey) : false);

  return content
    .replace(CHORD_TOKEN_RE, (_, chord: string) => {
      return `[${transposeChord(chord.trim(), semitones, preferFlats)}]`;
    })
    .replace(/\{\s*key\s*:\s*([^}]*?)\s*\}/gi, (whole, key: string) =>
      parseKey(key) ? `{key: ${transposeKey(key, semitones)}}` : whole,
    );
}

/** Transpõe para um tom alvo (ex.: G → A). */
export function transposeChordProToKey(content: string, fromKey: string, toKey: string): string {
  return transposeChordPro(content, semitonesBetween(fromKey, toKey), {
    fromKey,
    preferFlats: keyPrefersFlats(toKey),
  });
}
