/**
 * Conversor de "acordes sobre a letra" (formato de site/caderno) para ChordPro.
 *
 *   G       C        G          [G]Amazing [C]grace, how [G]sweet
 *   Amazing grace, how sweet →
 */
import { isChord } from './chord';

/** Marcas que podem aparecer numa linha de acordes sem serem acordes. */
const NEUTRAL_TOKEN_RE = /^(\||\|\||%|-+|\/|x\d+|\(x\d+\)|\(|\))$/i;
const LABEL_RE = /^[\p{L}\d ]+:$/u;

interface ChordAt {
  column: number;
  chord: string;
}

/** Linha só com acordes (opcionalmente com rótulo "Intro:" no começo)? */
export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  const start = tokens[0] && LABEL_RE.test(tokens[0]) ? 1 : 0;
  const rest = tokens.slice(start);
  return (
    rest.some((token) => isChord(token)) &&
    rest.every((token) => isChord(token) || NEUTRAL_TOKEN_RE.test(token))
  );
}

function chordPositions(line: string): ChordAt[] {
  const result: ChordAt[] = [];
  for (const match of line.matchAll(/\S+/g)) {
    if (isChord(match[0])) result.push({ column: match.index ?? 0, chord: match[0] });
  }
  return result;
}

/** Junta uma linha de acordes com a linha de letra logo abaixo. */
export function mergeChordLine(chordLine: string, lyricLine: string): string {
  const positions = chordPositions(chordLine);
  const longest = Math.max(...positions.map((p) => p.column), 0);
  let lyric = lyricLine.replace(/\s+$/, '');
  if (lyric.length < longest) lyric = lyric.padEnd(longest, ' ');
  // Insere da direita para a esquerda para não deslocar as colunas ainda não usadas.
  for (const { column, chord } of [...positions].reverse()) {
    lyric = `${lyric.slice(0, column)}[${chord}]${lyric.slice(column)}`;
  }
  return lyric.replace(/\s+$/, '');
}

/** Linha de acordes sem letra embaixo (intro, solo): vira "[G] [D] [Em]". */
function chordsOnly(line: string): string {
  return line
    .trim()
    .split(/\s+/)
    .map((token) => (isChord(token) ? `[${token}]` : token))
    .join(' ');
}

export function chordsOverLyricsToChordPro(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const output: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!isChordLine(line)) {
      output.push(line.replace(/\s+$/, ''));
      continue;
    }
    const next = lines[i + 1];
    const startsWithLabel = LABEL_RE.test(line.trim().split(/\s+/)[0] ?? '');
    if (!startsWithLabel && next !== undefined && next.trim() !== '' && !isChordLine(next)) {
      output.push(mergeChordLine(line, next));
      i++;
    } else {
      output.push(chordsOnly(line));
    }
  }
  return output.join('\n');
}
