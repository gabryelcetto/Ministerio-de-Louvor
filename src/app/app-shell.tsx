import {
  Activity,
  Bell,
  CalendarDays,
  ClipboardList,
  Home,
  LogOut,
  Megaphone,
  Menu,
  Music,
  Settings,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { brandTitle } from '@/config/brand';
import { signOut } from '@/features/auth/api';
import { useMyPermissions, useMyProfile } from '@/features/auth/hooks/use-me';
import type { PermissionKey } from '@/types/app.types';
import { unreadLabel, useUnreadCount } from '@/features/notificacoes/api';
import { cn } from '@/lib/utils';
import { isPathActive, splitMobileNav, type NavPlacement } from './nav';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** No celular: na barra inferior ('bar') ou no menu "Mais" ('more'). */
  mobile: NavPlacement;
  /** Só aparece com esta permissão (a proteção real é o banco). */
  permission?: PermissionKey;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Início', icon: Home, mobile: 'bar' },
  { to: '/escalas', label: 'Escalas', icon: ClipboardList, mobile: 'bar' },
  { to: '/repertorio', label: 'Repertório', icon: Music, mobile: 'bar' },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, mobile: 'bar' },
  // No celular, Notificações também fica no sino do topo (com contador).
  { to: '/notificacoes', label: 'Notificações', icon: Bell, mobile: 'more' },
  { to: '/comunicados', label: 'Comunicados', icon: Megaphone, mobile: 'more' },
  { to: '/integrantes', label: 'Integrantes', icon: Users, mobile: 'more' },
  {
    to: '/atividade',
    label: 'Atividade recente',
    icon: Activity,
    mobile: 'more',
    permission: 'history.view_all',
  },
  // Configurações pessoais (perfil, tema, instalar, sair): para todos.
  { to: '/configuracoes', label: 'Configurações', icon: Settings, mobile: 'more' },
];

function useVisibleItems() {
  const { data: permissions } = useMyPermissions();
  return NAV_ITEMS.filter(
    (item) => !item.permission || (permissions ?? []).includes(item.permission),
  );
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted',
  );

function UnreadDot({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[0.7rem] font-bold text-accent-foreground',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Layout autenticado: barra lateral no computador, barra inferior + menu "Mais" no celular. */
export function AppShell() {
  const items = useVisibleItems();
  const { data: profile } = useMyProfile();
  const { data: unread = 0 } = useUnreadCount();
  const name = profile?.display_name || profile?.full_name || '';
  const { bar, more } = splitMobileNav(items);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>

      <aside className="hidden border-r bg-card md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:gap-2 md:p-4">
        <div className="mb-4 flex items-center gap-2 px-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-accent">
            <Music aria-hidden="true" className="size-4" />
          </span>
          <span className="font-semibold leading-tight">{brandTitle}</span>
        </div>
        <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={linkClass}>
              <Icon aria-hidden="true" className="size-4" />
              <span className="flex-1">{label}</span>
              {to === '/notificacoes' && (
                <>
                  <UnreadDot count={unread} />
                  {unread > 0 && <span className="sr-only">({unreadLabel(unread)})</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <span className="truncate px-2 text-sm text-muted-foreground">{name}</span>
          <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Sair">
            <LogOut aria-hidden="true" />
          </Button>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between border-b bg-card px-4 py-2 md:hidden">
          <span className="truncate font-semibold">{brandTitle}</span>
          <div className="flex shrink-0 items-center gap-1">
            <Button asChild variant="ghost" size="icon" className="relative size-11">
              <Link to="/notificacoes" aria-label={`Notificações: ${unreadLabel(unread)}`}>
                <Bell aria-hidden="true" className="size-5" />
                <UnreadDot count={unread} className="absolute top-1 right-0.5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={() => void signOut()}
              aria-label="Sair"
            >
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </header>

        <main id="conteudo" className="flex-1 p-4 pb-24 md:p-8 md:pb-8">
          <Outlet />
        </main>

        <MobileNav bar={bar} more={more} unread={unread} />
      </div>
    </div>
  );
}

const barLinkClass = (active: boolean) =>
  cn(
    'flex min-h-14 w-full flex-col items-center justify-center gap-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
    active ? 'font-semibold text-primary' : 'text-muted-foreground',
  );

function MobileNav({ bar, more, unread }: { bar: NavItem[]; more: NavItem[]; unread: number }) {
  const { pathname } = useLocation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const moreActive = more.some((item) => isPathActive(pathname, item.to));
  const close = () => dialogRef.current?.close();

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5">
          {bar.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) => barLinkClass(isActive)}
              >
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </NavLink>
            </li>
          ))}
          {more.length > 0 && (
            <li>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-current={moreActive ? 'page' : undefined}
                onClick={() => dialogRef.current?.showModal()}
                className={cn(barLinkClass(moreActive), 'relative')}
              >
                <Menu aria-hidden="true" className="size-5" />
                Mais
                <UnreadDot count={unread} className="absolute top-1.5 left-1/2 ml-1.5" />
              </button>
            </li>
          )}
        </ul>
      </nav>

      {/* <dialog> nativo: prende o foco, fecha com Esc e devolve o foco ao botão "Mais". */}
      <dialog
        ref={dialogRef}
        aria-labelledby="menu-mais-titulo"
        onClick={(e) => e.target === e.currentTarget && close()}
        className="fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-2xl border-t bg-card p-0 text-card-foreground backdrop:bg-overlay md:hidden"
      >
        <div className="flex flex-col gap-1 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="menu-mais-titulo" className="text-lg font-semibold">
              Mais
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={close}
              aria-label="Fechar menu"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          <nav aria-label="Mais opções">
            <ul className="flex flex-col gap-1">
              {more.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={close}
                    className={({ isActive }) => cn(linkClass({ isActive }), 'min-h-12 text-base')}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                    <span className="flex-1">{label}</span>
                    {to === '/notificacoes' && <UnreadDot count={unread} />}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}
