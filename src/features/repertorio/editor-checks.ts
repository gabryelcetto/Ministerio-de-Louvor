import { getDeclaredKey, isChord, parseChordPro } from '@/lib/chords';

/**
 * Avisos (não bloqueiam o salvar) para quem edita a cifra: acordes que a transposição não vai
 * reconhecer, colchete sem fechar e falta do {key}.
 */
export function chordSheetWarnings(content: string): string[] {
  if (!content.trim()) return ['A cifra está vazia.'];
  const warnings: string[] = [];

  const unknown = new Set<string>();
  for (const match of content.matchAll(/\[([^\]\n]*)\]/g)) {
    const chord = (match[1] ?? '').trim();
    if (chord && !isChord(chord)) unknown.add(chord);
  }
  if (unknown.size > 0) {
    warnings.push(`Não reconhecido como acorde (não será transposto): ${[...unknown].join(', ')}.`);
  }

  const unclosed = content.split('\n').filter((line) => {
    const opens = (line.match(/\[/g) ?? []).length;
    const closes = (line.match(/\]/g) ?? []).length;
    return opens !== closes;
  });
  if (unclosed.length > 0) {
    warnings.push(
      `Colchete sem par em ${unclosed.length === 1 ? '1 linha' : `${unclosed.length} linhas`}.`,
    );
  }

  if (!getDeclaredKey(content)) {
    warnings.push('Sem {key: …}: o seletor de tom vai usar o tom original cadastrado.');
  }
  return warnings;
}

/** Letra a partir da cifra (sem acordes, diretivas e comentários) — ponto de partida da edição. */
export function chordProToLyrics(content: string): string {
  return parseChordPro(content)
    .flatMap((line) => {
      if (line.type === 'lyrics') return [line.segments.map((s) => s.text).join('')];
      if (line.type === 'empty') return [''];
      return [];
    })
    .join('\n')
    .trim();
}
