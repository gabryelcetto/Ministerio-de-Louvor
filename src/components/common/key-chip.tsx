import { cn } from '@/lib/utils';

/** Chip do tom (Repertório, escala e Início): accent-soft com texto accent-text, peso 800. */
export function KeyChip({
  value,
  className,
  label = 'Tom',
}: {
  value: string | null;
  className?: string;
  /** Texto lido pelo leitor de tela antes do tom ("Tom", "Tom do dia"). */
  label?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft px-2.5 py-1 text-sm font-extrabold text-brand-text',
        className,
      )}
    >
      <span className="sr-only">{label}: </span>
      {value ?? <span title="Tom não definido">—</span>}
    </span>
  );
}
