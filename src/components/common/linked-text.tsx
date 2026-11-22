import { linkify } from '@/lib/linkify';
import { cn } from '@/lib/utils';

/**
 * Texto do banco com quebras de linha preservadas e links clicáveis. Nunca usa HTML do banco:
 * cada pedaço vira texto ou <a> montado aqui (rel="noopener noreferrer", nova aba).
 */
export function LinkedText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn('break-words whitespace-pre-line', className)}>
      {linkify(text).map((part, i) =>
        part.kind === 'link' ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-text underline underline-offset-2"
          >
            {part.text}
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}
