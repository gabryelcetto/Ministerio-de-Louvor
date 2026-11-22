import {
  Activity,
  CalendarOff,
  ChevronRight,
  ClipboardList,
  ListChecks,
  LogOut,
  Megaphone,
  Palette,
  ShieldCheck,
  Smartphone,
  UserCog,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormError } from '@/components/common/form-error';
import { signOut, useMyPermissions, useMyProfile } from '@/features/auth';
import { initials } from '@/features/escalas';
import { SECTION_BADGE, sectionsOf, useMyFunctions } from '@/features/integrantes';
import { MESSAGES } from '@/lib/messages';
import type { PermissionKey } from '@/types/app.types';

interface MoreItem {
  to: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  permission?: PermissionKey;
}

const GROUPS: { title: string; items: MoreItem[] }[] = [
  {
    title: 'Ministério',
    items: [
      { to: '/integrantes', label: 'Integrantes', icon: Users },
      { to: '/comunicados', label: 'Comunicados', icon: Megaphone },
      {
        to: '/indisponibilidades',
        label: 'Minhas indisponibilidades',
        hint: 'Dias em que você não pode ser escalado(a)',
        icon: CalendarOff,
      },
    ],
  },
  {
    title: 'Configurações',
    items: [
      {
        to: '/configuracoes#aparencia',
        label: 'Aparência',
        hint: 'Claro, escuro ou automático',
        icon: Palette,
      },
      {
        to: '/configuracoes#minha-conta',
        label: 'Minha conta',
        hint: 'Perfil e senha',
        icon: UserCog,
      },
      { to: '/instalar', label: 'Instalar o app', icon: Smartphone },
      { to: '/privacidade', label: 'Privacidade', icon: ShieldCheck },
    ],
  },
  {
    title: 'Administração',
    items: [
      {
        to: '/escalas/montar',
        label: 'Montar escala',
        icon: ClipboardList,
        permission: 'schedules.manage',
      },
      {
        to: '/integrantes/cadastrar',
        label: 'Cadastrar integrante',
        icon: UserPlus,
        permission: 'members.manage',
      },
      {
        to: '/integrantes/funcoes',
        label: 'Funções do ministério',
        icon: ListChecks,
        permission: 'members.manage',
      },
      {
        to: '/atividade',
        label: 'Atividade recente',
        icon: Activity,
        permission: 'history.view_all',
      },
    ],
  },
];

/**
 * Tela "Mais" (5º item da barra): quem está logado, atalhos (Integrantes, Comunicados,
 * Configurações, Instalar), itens de administração conforme a permissão e, no fim, Sair.
 */
export function MorePage() {
  const profile = useMyProfile();
  const permissions = useMyPermissions();
  const functions = useMyFunctions();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const name = profile.data?.display_name || profile.data?.full_name || '';
  const sections = sectionsOf(functions.data ?? []);
  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || (permissions.data ?? []).includes(item.permission),
    ),
  })).filter((group) => group.items.length > 0);

  const logout = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch (e) {
      setError(e);
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <section className="mx-auto flex max-w-[45rem] flex-col gap-6">
      <h1 className="sr-only">Mais</h1>
      <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg font-extrabold text-brand-text"
        >
          {initials(name) || '?'}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-card-title">{name || 'Carregando…'}</span>
          <span className="text-sm text-muted-foreground">
            {sections.length > 0
              ? sections.map((s) => SECTION_BADGE[s]).join(' · ')
              : 'Integrante do ministério'}
          </span>
        </div>
      </div>

      {groups.map((group) => (
        <nav key={group.title} aria-label={group.title} className="flex flex-col gap-2">
          <h2 className="section-label px-1">{group.title}</h2>
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border bg-card">
            {group.items.map(({ to, label, hint, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
                  <span className="flex flex-1 flex-col">
                    <span className="font-semibold">{label}</span>
                    {hint && <span className="text-caption text-muted-foreground">{hint}</span>}
                  </span>
                  <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 font-semibold text-destructive hover:border-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut aria-hidden="true" className="size-5" />
          Sair
        </button>
        <FormError error={error} fallback={MESSAGES.signOutFailed} />
      </div>

      <ConfirmDialog
        open={confirming}
        title="Sair do app?"
        confirmLabel="Sair"
        destructive
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void logout()}
      >
        Para entrar de novo neste aparelho, você vai precisar do e-mail e da senha.
      </ConfirmDialog>
    </section>
  );
}
