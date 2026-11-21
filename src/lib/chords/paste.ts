/**
 * Cifra COLADA pela pessoa (de um site, de um caderno, de outro app) → ChordPro.
 *
 * Aceita os dois formatos comuns:
 * - ChordPro: "[G]Santo, [D]santo";
 * - "acordes em cima da letra" (como os sites de cifra mostram), com marcadores de parte como
 *   "[Refrão]", "[Intro] G D Em C", "Intro: G D" e linhas só de acordes.
 * Nada aqui busca conteúdo na internet: só converte o texto que a pessoa colou.
 */
import { isChord, parseChord } from './chord';
import { getDeclaredKey, parseChordPro } from './chordpro';
import { isChordLine, mergeChordLine } from './convert';
import { allKeys, keyName, noteToPitch } from './notes';

export type PastedFormat = 'chordpro' | 'chords-over-lyrics' | 'lyrics-only' | 'empty';

/** "[Refrão]", "[Primeira Parte]", "[Intro] G D Em C" — marcador de parte (não é acorde). */
const SECTION_RE = /^\s*\[([^\]]+)\]\s*(.*)$/;
/** "Parte 1 de 3" e similares (cabeçalho de página dos sites). */
/** Espaço não separável (U+00A0), comum em texto copiado de páginas web. */
const NBSP = String.fromCharCode(0xa0);
const PAGE_RE = /^\s*parte\s+\d+\s+de\s+\d+\s*$/i;

function normalize(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .split(NBSP)
    .join(' ') // espaço "não separável" que vem colado de páginas web
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''));
}

function isSectionMarker(line: string): { label: string; rest: string } | null {
  const match = SECTION_RE.exec(line);
  if (!match || !match[1]) return null;
  const label = match[1].trim();
  if (isChord(label)) return null; // "[G]" sozinho é acorde (ChordPro), não marcador
  return { label, rest: (match[2] ?? '').trim() };
}

/** Linha de letra com acorde entre colchetes no meio do texto ("[G]Santo") = ChordPro. */
function hasInlineChord(line: string): boolean {
  for (const match of line.matchAll(/\[([^\]\n]+)\]/g)) {
    if (isChord(match[1] ?? '')) {
      const rest = line.replace(/\[[^\]\n]*\]/g, '').trim();
      if (rest !== '') return true;
    }
  }
  return false;
}

export function detectPastedFormat(text: string): PastedFormat {
  const lines = normalize(text).filter((l) => l.trim() !== '');
  if (lines.length === 0) return 'empty';
  if (lines.some((l) => /^\s*\{[a-z_]+(:.*)?\}\s*$/i.test(l) || hasInlineChord(l)))
    return 'chordpro';
  const body = lines.map((l) => {
    const section = isSectionMarker(l);
    return section ? section.rest : l;
  });
  if (body.some((l) => l.trim() !== '' && isChordLine(l))) return 'chords-over-lyrics';
  return 'lyrics-only';
}

/** Linha só de acordes (intro, solo, final): "G D Em" → "[G] [D] [Em]". */
function chordsOnly(line: string): string {
  return line
    .trim()
    .split(/\s+/)
    .map((token) => (isChord(token) ? `[${token}]` : token))
    .join(' ');
}

function convertChordsOverLyrics(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (PAGE_RE.test(line)) continue;

    const section = isSectionMarker(line);
    if (section) {
      out.push(`{c: ${section.label}}`);
      if (section.rest)
        out.push(isChordLine(section.rest) ? chordsOnly(section.rest) : section.rest);
      continue;
    }

    if (!isChordLine(line)) {
      out.push(line);
      continue;
    }
    const next = lines[i + 1];
    const startsWithLabel = /^[\p{L}\d ]+:$/u.test(line.trim().split(/\s+/)[0] ?? '');
    const mergeable =
      !startsWithLabel &&
      next !== undefined &&
      next.trim() !== '' &&
      !isChordLine(next) &&
      !isSectionMarker(next) &&
      !PAGE_RE.test(next);
    if (mergeable) {
      out.push(mergeChordLine(line, next));
      i++;
    } else {
      out.push(chordsOnly(line));
    }
  }
  return out;
}

export interface PastedResult {
  format: PastedFormat;
  /** Cifra em ChordPro (vazia se o texto não tinha acordes). */
  chordpro: string;
}

/** Converte o texto colado para ChordPro (ChordPro entra como está, com marcadores de parte). */
export function convertPastedChords(text: string): PastedResult {
  const format = detectPastedFormat(text);
  const lines = normalize(text);
  let out: string[];
  if (format === 'chordpro') {
    out = lines.map((line) => {
      const section = isSectionMarker(line);
      if (section && !section.rest) return `{c: ${section.label}}`;
      return line;
    });
  } else if (format === 'chords-over-lyrics') {
    out = convertChordsOverLyrics(lines);
  } else {
    return { format, chordpro: '' };
  }
  // Sem linhas em branco sobrando no começo/fim e no máximo uma em branco seguida.
  const chordpro = out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { format, chordpro };
}

/** Letra a partir da cifra: sem acordes, diretivas e marcadores de parte. */
export function lyricsFromChordPro(content: string): string {
  return parseChordPro(content)
    .flatMap((line) => {
      if (line.type === 'lyrics') {
        const text = line.segments.map((s) => s.text).join('');
        return text.trim() === '' ? [] : [text.trimEnd()];
      }
      if (line.type === 'empty') return [''];
      return [];
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Graus de um tom maior: I ii iii IV V vi (vii° raro em louvor; não pesa).
const MAJOR_DEGREES: { interval: number; minor: boolean }[] = [
  { interval: 0, minor: false },
  { interval: 2, minor: true },
  { interval: 4, minor: true },
  { interval: 5, minor: false },
  { interval: 7, minor: false },
  { interval: 9, minor: true },
];

/**
 * Tom provável da cifra. Usa o {key: X} se existir; senão, pontua os 24 tons pelos acordes
 * que cabem no campo harmônico (V7 conta como dominante) e dá bônus ao primeiro e ao último
 * acorde (músicas costumam começar e terminar na tônica). `null` se não houver acordes.
 */
export function guessKey(chordpro: string): string | null {
  const declared = getDeclaredKey(chordpro);
  if (declared) return declared;

  const chords = [...chordpro.matchAll(/\[([^\]\n]+)\]/g)]
    .map((m) => parseChord(m[1] ?? ''))
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => ({
      pitch: noteToPitch(c.root),
      minor: /^m(?!aj)/.test(c.suffix) || /^(°|º|dim|ø)/.test(c.suffix),
    }));
  if (chords.length === 0) return null;

  let best: { name: string; score: number } | null = null;
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const minorKey of [false, true]) {
      // Tom menor = relativo do maior 3 semitons acima (mesmo campo harmônico).
      const majorTonic = minorKey ? (tonic + 3) % 12 : tonic;
      let score = 0;
      for (const chord of chords) {
        const interval = (chord.pitch - majorTonic + 12) % 12;
        const degree = MAJOR_DEGREES.find((d) => d.interval === interval);
        if (degree && degree.minor === chord.minor) score += 2;
        else if (degree) score += 1;
      }
      const isTonic = (c: { pitch: number; minor: boolean }) =>
        c.pitch === tonic && c.minor === minorKey;
      if (isTonic(chords[0]!)) score += 3;
      if (isTonic(chords[chords.length - 1]!)) score += 3;
      if (!best || score > best.score) best = { name: keyName(tonic, minorKey), score };
    }
  }
  return best?.name ?? null;
}

/** Põe/atualiza o {key: X} no topo da cifra. */
export function withDeclaredKey(chordpro: string, key: string): string {
  if (/\{\s*key\s*:[^}]*\}/i.test(chordpro)) {
    return chordpro.replace(/\{\s*key\s*:[^}]*\}/i, `{key: ${key}}`);
  }
  return `{key: ${key}}\n${chordpro}`;
}

/**
 * Tom sugerido pelo PRIMEIRO acorde da cifra (Nova música): "[Em7]..." → "Em"; "[D/F#]" → "D".
 * Marcações que não são acorde ("[Intro]", "[Refrão]") são puladas. Devolve a grafia usada na
 * lista de tons (ex.: "A#" vira "Bb"). `null` quando não há acorde.
 */
export function firstChordKey(chordpro: string): string | null {
  for (const match of chordpro.matchAll(/\[([^\]\n]+)\]/g)) {
    const chord = parseChord(match[1] ?? '');
    if (!chord) continue;
    const minor = /^(m(?!aj)|min|-)/.test(chord.suffix);
    const pitch = noteToPitch(chord.root);
    const key = allKeys(minor).find((k) => noteToPitch(minor ? k.slice(0, -1) : k) === pitch);
    return key ?? `${chord.root}${minor ? 'm' : ''}`;
  }
  return null;
}
