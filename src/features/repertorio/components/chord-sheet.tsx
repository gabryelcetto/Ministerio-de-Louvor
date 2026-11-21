import { useMemo, type CSSProperties } from 'react';
import { parseChordPro, toSheetUnits, transposeChordPro } from '@/lib/chords';
import { cn } from '@/lib/utils';

export interface ChordSheetProps {
  /** Cifra em ChordPro ("[G]Amazing [C]grace"). */
  content: string;
  /** Semitons para transpor (0 = tom original da cifra). */
  semitones?: number;
  /** Tom atual da cifra; se omitido, usa {key: X} do conteúdo. */
  fromKey?: string | null;
  /** false = mostra só a letra. */
  showChords?: boolean;
  className?: string;
  /** Tamanho da letra (botão Aa): o acorde acompanha (0,8 em = 16px com letra de 20px). */
  style?: CSSProperties;
}

/**
 * Renderiza a cifra com o acorde em cima da sílaba. Cada acorde fica "colado" à sua
 * sílaba (inline-flex em coluna) e a linha quebra entre palavras, então no celular
 * a letra continua legível sem rolagem horizontal.
 */
export function ChordSheet({
  content,
  semitones = 0,
  fromKey,
  showChords = true,
  className,
  style,
}: ChordSheetProps) {
  const lines = useMemo(() => {
    const source = semitones === 0 ? content : transposeChordPro(content, semitones, { fromKey });
    return parseChordPro(source);
  }, [content, semitones, fromKey]);

  return (
    // Letra 20px com linha de 1,35 (design); o tamanho vem do botão Aa pelo `style`.
    <div className={cn('font-sans text-[1.25rem] leading-[1.35]', className)} style={style}>
      {lines.map((line, lineIndex) => {
        const key = `${lineIndex}`;
        switch (line.type) {
          case 'empty':
            return <div key={key} className="h-4" aria-hidden="true" />;
          case 'comment':
            return (
              // Partes (ESTROFE, REFRÃO…) no estilo de rótulo de seção.
              <p key={key} className="section-label mt-5 mb-1">
                {line.text}
              </p>
            );
          case 'directive':
            // title/key/etc. são exibidos pela tela da música, não dentro da cifra.
            return null;
          case 'lyrics': {
            const units = toSheetUnits(line.segments);
            const hasChord = showChords && units.some((unit) => unit.chord);
            return (
              <p key={key} className="flex flex-wrap items-end">
                {units.map((unit, unitIndex) => (
                  // max-w-full + quebra "anywhere" no texto: uma palavra maior que a tela quebra
                  // dentro dela (antes, empurrava a página para o lado no celular).
                  <span key={unitIndex} className="inline-flex max-w-full flex-col">
                    {hasChord && (
                      <span
                        className={cn(
                          // Tamanho em em: acompanha o tamanho da letra escolhido na tela.
                          'min-h-[1.25em] pr-1 text-[0.8em] font-extrabold whitespace-pre text-chord',
                          !unit.chord && 'select-none',
                        )}
                      >
                        {unit.chord ?? ' '}
                      </span>
                    )}
                    <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                      {unit.text === '' && hasChord ? ' ' : unit.text}
                    </span>
                  </span>
                ))}
              </p>
            );
          }
        }
      })}
    </div>
  );
}
