/**
 * Prepara uma linha para exibição no celular: quebra o texto em "unidades" que podem
 * mudar de linha sem separar o acorde da sílaba onde ele cai.
 */
import type { Segment } from './chordpro';

export interface SheetUnit {
  chord: string | null;
  text: string;
}

/**
 * Cada segmento vira: [acorde + primeira palavra] e depois uma unidade por palavra.
 * Assim o navegador quebra a linha entre palavras, nunca entre o acorde e sua sílaba.
 */
export function toSheetUnits(segments: Segment[]): SheetUnit[] {
  const units: SheetUnit[] = [];
  for (const segment of segments) {
    const parts = segment.text.match(/\S*\s*/g)?.filter((part) => part !== '') ?? [];
    if (parts.length === 0) {
      units.push({ chord: segment.chord, text: '' });
      continue;
    }
    parts.forEach((part, index) => {
      units.push({ chord: index === 0 ? segment.chord : null, text: part });
    });
  }
  return units;
}
