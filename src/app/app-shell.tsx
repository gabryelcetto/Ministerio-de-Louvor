import {
  Bell,
  CalendarDays,
  ClipboardList,
  Home,
  Megaphone,
  Menu,
  Music,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { FlameLogo } from '@/components/brand/flame-logo';
import { OfflineBanner } from '@/components/common/offline-banner';
import { brand } from '@/config/brand';
import { unreadLabel, useUnreadCount } from '@/features/notificacoes';
import { cn } from '@/lib/utils';
import { activePrimary, isMainScreen } from './nav';
import { ThemeChoiceDialog } from './theme-choice-dialog';
import { usePreloadNextSongs } from './use-preload-next-songs';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Barra de baixo (celular) e começo da lateral (computador). */
const PRIMARY: NavItem[] = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/escalas', label: 'Escalas', icon: ClipboardList },
  { to: '/repertorio', label: 'Repertório', icon: Music },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/mais', label: 'Mais', icon: Menu },
];
/** Só na lateral do computador. */
const DESKTOP_EXTRA: NavItem[] = [
  { to: '/integrantes', label: 'Integrantes', icon: Users },
  { to: '/comunicados', label: 'Comunicados', icon: Megaphone },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute top-1 right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[0.6875rem] font-bold text-brand-ink"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Sino com o número de notificações não lidas (as notificações só abrem por aqui). */
function NotificationsBell() {
  const { data: unread = 0 } = useUnreadCount();
  return (
    <Link
      to="/notificacoes"
      aria-label={`Notificações: ${unreadLabel(unread)}`}
      className="relative flex size-11 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Bell aria-hidden="true" className="size-5" />
      <UnreadBadge count={unread} />
    </Link>
  );
}

/** Topo das telas principais: chama + "Louvor ADVOP" à esquerda, sino à direita. */
function MainHeader() {
  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-8">
      <Link
        to="/"
        className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:invisible"
      >
        <FlameLogo />
        <span className="text-[1.0625rem] font-extrabold tracking-tight">{brand.shortName}</span>
      </Link>
      <NotificationsBell />
    </header>
  );
}

const sideLinkClass = (active: boolean) =>
  cn(
    'flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active
      ? 'bg-brand-soft text-brand-text'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );

function SideNav({ active }: { active: string | null }) {
  const { pathname } = useLocation();
  return (
    <aside className="hidden border-r bg-card md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:gap-4 md:p-4">
      <Link
        to="/"
        className="flex items-center gap-2 rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <FlameLogo tile className="size-9" />
        <span className="text-[1.0625rem] font-extrabold tracking-tight">{brand.shortName}</span>
      </Link>
      <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1">
        {PRIMARY.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            aria-current={active === to ? 'page' : undefined}
            className={sideLinkClass(active === to)}
          >
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </Link>
        ))}
        <hr className="my-2 border-line" />
        {DESKTOP_EXTRA.map(({ to, label, icon: Icon }) => {
          const on = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <NavLink key={to} to={to} className={sideLinkClass(on)}>
              <Icon aria-hidden="true" className="size-5" />
              {label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

function BottomNav({ active }: { active: string | null }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5 gap-1 px-1 py-1.5">
        {PRIMARY.map(({ to, label, icon: Icon }) => {
          const on = active === to;
          return (
            <li key={to}>
              <Link
                to={to}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.75rem] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  on ? 'bg-brand-soft text-brand-text' : 'text-muted-foreground',
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Layout autenticado. Celular: barra de baixo fixa (Início, Escalas, Repertório, Agenda, Mais).
 * Computador: lateral com os mesmos itens + Integrantes, Comunicados e Configurações.
 * Telas principais têm o topo do app (chama + sino); as internas desenham o próprio cabeçalho
 * (ScreenHeader: voltar + título + ⋯). Sair fica só na tela Mais.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const active = activePrimary(pathname);
  const main = isMainScreen(pathname);
  usePreloadNextSongs();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <SideNav active={active} />
      <div className="flex min-h-dvh min-w-0 flex-col">
        <OfflineBanner />
        {main && <MainHeader />}
        <main
          id="conteudo"
          className={cn(
            'flex-1 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:px-8 md:pb-10',
            main && 'pt-4 md:pt-6',
          )}
        >
          <Outlet />
        </main>
        <BottomNav active={active} />
      </div>
      <ThemeChoiceDialog />
    </div>
  );
}
