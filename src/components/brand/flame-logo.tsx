import { cn } from '@/lib/utils';

/**
 * Chama do Louvor ADVOP (o mesmo desenho do ícone do app, scripts/generate-icons.mjs).
 * `tile`: sobre o quadrado escuro do ícone (login, Mais); sem `tile`: só a chama (topo).
 * Decorativa por padrão; com `label`, vira imagem com nome acessível.
 */
export function FlameLogo({
  className,
  tile = false,
  label,
}: {
  className?: string;
  tile?: boolean;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-7 shrink-0', className)}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {tile && <rect width="24" height="24" rx="5.3" fill="var(--ds-flame-tile)" />}
      <g transform={tile ? 'translate(12 12) scale(0.8) translate(-12 -9.75)' : undefined}>
        <path
          d="M12 1.8c1.2 3.7 5.3 5.8 5.3 10.6a5.3 5.3 0 0 1-10.6.1c0-2.5 1.4-3.9 2.6-5.1.2 1.9 1 3 2.2 3.6C11 7.9 11.3 4.6 12 1.8z"
          fill="var(--ds-flame)"
        />
        <path
          d="M12 10.6c.5 1.7 2.4 2.6 2.4 4.8a2.4 2.4 0 0 1-4.8 0c0-1.3.7-2.1 1.4-2.8.1 1 .5 1.4 1.1 1.7-.2-1.4-.3-2.5-.1-3.7z"
          fill="var(--ds-flame-core)"
        />
      </g>
    </svg>
  );
}
