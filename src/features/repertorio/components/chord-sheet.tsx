import { useMemo } from 'react';
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
}: ChordSheetProps) {
  const lines = useMemo(() => {
    const source = semitones === 0 ? content : transposeChordPro(content, semitones, { fromKey });
    return parseChordPro(source);
  }, [content, semitones, fromKey]);

  return (
    <div className={cn('font-sans text-base leading-snug', className)}>
      {lines.map((line, lineIndex) => {
        const key = `${lineIndex}`;
        switch (line.type) {
          case 'empty':
            return <div key={key} className="h-4" aria-hidden="true" />;
          case 'comment':
            return (
              <p key={key} className="mt-3 text-sm font-semibold text-secondary-foreground">
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
                  <span key={unitIndex} className="inline-flex flex-col whitespace-pre">
                    {hasChord && (
                      <span
                        className={cn(
                          'min-h-[1.25em] pr-1 font-mono text-sm font-bold text-primary',
                          !unit.chord && 'select-none',
                        )}
                      >
                        {unit.chord ?? ' '}
                      </span>
                    )}
                    <span>{unit.text === '' && hasChord ? ' ' : unit.text}</span>
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
