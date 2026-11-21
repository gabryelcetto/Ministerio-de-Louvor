import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { cn } from '@/lib/utils';

/**
 * Cabeçalho das telas internas (igual em todas): voltar + título (com subtítulo opcional) +
 * ações à direita (normalmente o menu ⋯). Fica preso no topo ao rolar.
 * Voltar usa o histórico quando a pessoa veio de dentro do app; senão, vai para `back`.
 */
export function ScreenHeader({
  title,
  subtitle,
  back,
  backLabel = 'Voltar',
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Para onde voltar quando a tela foi aberta direto (link, notificação). */
  back: string;
  backLabel?: string;
  actions?: ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  // O React Router marca a primeira entrada do histórico com a chave "default".
  const cameFromApp = location.key !== 'default';

  return (
    <header
      className={cn(
        'sticky top-0 z-30 -mx-4 mb-4 flex min-h-14 items-center gap-1 border-b bg-background/95 px-2 py-1.5 backdrop-blur md:-mx-8 md:px-6',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => void (cameFromApp ? navigate(-1) : navigate(back))}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
        <span className="sr-only">{backLabel}</span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate text-card-title">{title}</h1>
        {subtitle && <p className="truncate text-caption text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}

/** Título das telas principais (Início, Escalas, Repertório, Agenda), abaixo do topo do app. */
export function PageTitle({
  children,
  description,
}: {
  children: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-screen-title">{children}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
