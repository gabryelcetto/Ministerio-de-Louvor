import { Check } from 'lucide-react';
import type { ThemePref } from '@/lib/theme';
import { cn } from '@/lib/utils';

const THEME_OPTIONS: { value: ThemePref; label: string; hint: string }[] = [
  { value: 'light', label: 'Claro', hint: 'Fundo claro' },
  { value: 'dark', label: 'Escuro', hint: 'Bom para o palco e à noite' },
  { value: 'system', label: 'Automático', hint: 'Segue o celular' },
];

/**
 * Miniatura da tela num tema (barra, título, um acorde e linhas). A classe .light/.dark no
 * próprio desenho redefine os tokens do design ali dentro: a miniatura mostra o outro tema
 * usando só as variáveis de src/index.css.
 */
function Miniature({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <svg viewBox="0 0 60 44" aria-hidden="true" className={cn('h-full w-full', theme)}>
      <rect width="60" height="44" rx="6" fill="var(--ds-bg)" />
      <rect
        x="5"
        y="5"
        width="50"
        height="34"
        rx="4"
        fill="var(--ds-surface)"
        stroke="var(--ds-line)"
      />
      <rect x="10" y="10" width="22" height="4" rx="2" fill="var(--ds-ink)" />
      <rect x="10" y="18" width="8" height="3" rx="1.5" fill="var(--ds-chord)" />
      <rect x="10" y="23" width="38" height="3" rx="1.5" fill="var(--ds-ink)" opacity="0.75" />
      <rect x="10" y="30" width="30" height="3" rx="1.5" fill="var(--ds-ink)" opacity="0.45" />
    </svg>
  );
}

function Thumb({ value }: { value: ThemePref }) {
  if (value !== 'system') return <Miniature theme={value} />;
  // Automático: metade clara, metade escura.
  return (
    <span className="relative block h-full w-full">
      <Miniature theme="light" />
      <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
        <Miniature theme="dark" />
      </span>
    </span>
  );
}

/** Três opções grandes (Claro, Escuro, Automático) num grupo de rádio acessível. */
export function ThemeOptions({
  value,
  onChange,
  name,
  large = false,
}: {
  value: ThemePref;
  onChange: (pref: ThemePref) => void;
  name: string;
  large?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2 sm:gap-3">
      {THEME_OPTIONS.map((option) => {
        const checked = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              'relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 bg-card p-2 text-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
              checked ? 'border-brand' : 'border-line hover:border-muted-foreground',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className={cn('block w-full', large ? 'aspect-[4/3]' : 'aspect-[3/2]')}>
              <Thumb value={option.value} />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold">{option.label}</span>
              {large && <span className="text-caption text-muted-foreground">{option.hint}</span>}
            </span>
            {checked && (
              <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-brand text-brand-ink">
                <Check aria-hidden="true" className="size-3.5" />
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
