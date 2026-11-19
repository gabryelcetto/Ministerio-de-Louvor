import {
  Bell,
  CalendarDays,
  ClipboardList,
  Home,
  LogOut,
  Megaphone,
  Music,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { Button } from '@/components/ui/button';
import { signOut } from '@/features/auth/api';
import { useMyProfile } from '@/features/auth/hooks/use-me';
import { usePermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** No celular, só os principais ficam na barra inferior. */
  primary?: boolean;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Início', icon: Home, primary: true },
  { to: '/escalas', label: 'Escalas', icon: ClipboardList, primary: true },
  { to: '/repertorio', label: 'Repertório', icon: Music, primary: true },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, primary: true },
  { to: '/notificacoes', label: 'Notificações', icon: Bell, primary: true },
  { to: '/comunicados', label: 'Comunicados', icon: Megaphone },
  { to: '/integrantes', label: 'Integrantes', icon: Users },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, adminOnly: true },
];

function useVisibleItems() {
  const canManageMembers = usePermission('members.manage');
  const canManagePermissions = usePermission('permissions.manage');
  const isAdmin = canManageMembers || canManagePermissions;
  return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted',
  );

/** Layout autenticado: barra lateral no computador, barra inferior no celular. */
export function AppShell() {
  const items = useVisibleItems();
  const { data: profile } = useMyProfile();
  const name = profile?.display_name || profile?.full_name || '';

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>

      <aside className="hidden border-r bg-card md:flex md:flex-col md:gap-2 md:p-4">
        <div className="mb-4 flex items-center gap-2 px-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-accent">
            <Music aria-hidden="true" className="size-4" />
          </span>
          <span className="font-semibold">Ministério de Louvor</span>
        </div>
        <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={linkClass}>
              <Icon aria-hidden="true" className="size-4" />
              {label}
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
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <span className="font-semibold">Ministério de Louvor</span>
          <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Sair">
            <LogOut aria-hidden="true" />
          </Button>
        </header>

        <main id="conteudo" className="flex-1 p-4 pb-24 md:p-8 md:pb-8">
          <Outlet />
        </main>

        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <ul className="grid grid-cols-5">
            {items
              .filter((item) => item.primary)
              .map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-14 flex-col items-center justify-center gap-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        isActive ? 'font-semibold text-primary' : 'text-muted-foreground',
                      )
                    }
                  >
                    <Icon aria-hidden="true" className="size-5" />
                    {label}
                  </NavLink>
                </li>
              ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
