import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

export interface OverflowMenuItem {
  label: string;
  icon?: LucideIcon;
  /** Ação (ou `to` para navegar). */
  onSelect?: () => void;
  to?: string;
  destructive?: boolean;
}

/**
 * Menu ⋯ do cabeçalho: botão + lista de ações (padrão WAI-ARIA de menu: setas, Home/End, Esc
 * fecha e devolve o foco ao botão; clicar fora fecha). Itens que a pessoa não pode usar não
 * entram na lista (a proteção real é o banco).
 */
export function OverflowMenu({
  items,
  label = 'Mais opções',
}: {
  items: OverflowMenuItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  if (items.length === 0) return null;

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const all = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = all.indexOf(document.activeElement as HTMLElement);
    const focus = (i: number) => all[(i + all.length) % all.length]?.focus();
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focus(index + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focus(index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focus(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focus(all.length - 1);
    }
  };

  const itemClass = (destructive?: boolean) =>
    cn(
      'flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-[0.9375rem] font-medium hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
      // Vermelho como texto só tem contraste AA sobre a superfície: sem fundo cinza no hover/foco.
      destructive &&
        'text-destructive hover:bg-transparent hover:underline focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-destructive',
    );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal aria-hidden="true" className="size-5" />
        <span className="sr-only">{label}</span>
      </button>
      {open && (
        <ul
          ref={menuRef}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className="absolute top-full right-0 z-40 mt-1 flex w-64 flex-col gap-0.5 rounded-xl border bg-card p-1.5 text-card-foreground shadow-lg"
        >
          {items.map(({ label: text, icon: Icon, onSelect, to, destructive }) => (
            <li key={text} role="none">
              {to ? (
                <Link
                  role="menuitem"
                  to={to}
                  tabIndex={-1}
                  onClick={() => setOpen(false)}
                  className={itemClass(destructive)}
                >
                  {Icon && <Icon aria-hidden="true" className="size-5 text-muted-foreground" />}
                  {text}
                </Link>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    setOpen(false);
                    onSelect?.();
                  }}
                  className={itemClass(destructive)}
                >
                  {Icon && (
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        'size-5',
                        destructive ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    />
                  )}
                  {text}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
