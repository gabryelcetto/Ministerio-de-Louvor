import { useMutation, useQuery } from '@tanstack/react-query';
import { LogOut, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { FormError } from '@/components/common/form-error';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { signOut } from '@/features/auth/api';
import { StorageUsageCard } from '@/features/audio/components/storage-usage-card';
import { PasswordForm } from '@/features/auth/components/password-form';
import { useMyProfile } from '@/features/auth/hooks/use-me';
import { useSession } from '@/features/auth/session-context';
import { InstallButton } from '@/features/instalar/components/install-button';
import { ROLE_LABEL } from '@/features/integrantes/api';
import { supabase } from '@/lib/supabase';
import { useThemePref, type ThemePref } from '@/lib/theme';
import { cn } from '@/lib/utils';

async function fetchMyFunctions(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('member_functions')
    .select('function:ministry_functions(name, sort_order)')
    .eq('user_id', userId);
  if (error) throw error;
  return data
    .map((row) => row.function)
    .filter((f): f is { name: string; sort_order: number } => f !== null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((f) => f.name);
}

/** Configurações pessoais: perfil, tema, senha, instalação do app e sair. */
export function SettingsPage() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-semibold">Configurações</h1>
      <ProfileCard />
      <ThemeCard />
      <Section title="Trocar senha">
        <PasswordForm askCurrent submitLabel="Trocar senha" />
      </Section>
      <Section title="Aplicativo">
        <p className="text-sm text-muted-foreground">
          Instale para abrir pelo ícone na tela inicial, em tela cheia.
        </p>
        <InstallButton variant="outline" className="self-start" />
      </Section>
      <StorageUsageCard />
      <SignOutCard />
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

function ProfileCard() {
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useMyProfile();
  const functions = useQuery({
    queryKey: ['me', 'functions', userId],
    queryFn: () => fetchMyFunctions(userId as string),
    enabled: Boolean(userId),
  });

  return (
    <Section title="Meu perfil">
      {profile.isPending ? (
        <LoadingState label="Carregando perfil…" />
      ) : profile.isError ? (
        <ErrorState onRetry={() => void profile.refetch()} />
      ) : (
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Nome</dt>
          <dd className="font-medium">{profile.data.full_name || '—'}</dd>
          {profile.data.display_name && (
            <>
              <dt className="text-muted-foreground">Como aparece</dt>
              <dd className="font-medium">{profile.data.display_name}</dd>
            </>
          )}
          {session?.user.email && (
            <>
              <dt className="text-muted-foreground">E-mail</dt>
              <dd className="font-medium break-all">{session.user.email}</dd>
            </>
          )}
          {ROLE_LABEL[profile.data.access_role] && (
            <>
              <dt className="text-muted-foreground">Papel</dt>
              <dd className="font-medium">{ROLE_LABEL[profile.data.access_role]}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Funções</dt>
          <dd>
            {functions.isPending ? (
              <span className="text-muted-foreground">Carregando…</span>
            ) : functions.isError ? (
              <button
                type="button"
                onClick={() => void functions.refetch()}
                className="rounded text-destructive underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Não foi possível carregar. Tentar de novo
              </button>
            ) : functions.data.length === 0 ? (
              <span className="text-muted-foreground">Nenhuma função definida</span>
            ) : (
              <span className="flex flex-wrap gap-1.5">
                {functions.data.map((fn) => (
                  <span
                    key={fn}
                    className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                  >
                    {fn}
                  </span>
                ))}
              </span>
            )}
          </dd>
        </dl>
      )}
      <p className="text-xs text-muted-foreground">
        Para mudar nome ou funções, fale com a liderança.
      </p>
    </Section>
  );
}

const THEMES: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

function ThemeCard() {
  const [pref, setPref] = useThemePref();
  return (
    <Section title="Aparência">
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              'flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
              pref === value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-muted',
            )}
          >
            <input
              type="radio"
              name="tema"
              value={value}
              checked={pref === value}
              onChange={() => setPref(value)}
              className="sr-only"
            />
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        "Sistema" segue o tema do aparelho. A escolha vale para este navegador.
      </p>
    </Section>
  );
}

function SignOutCard() {
  const logout = useMutation({ mutationFn: signOut });
  return (
    <Section title="Conta">
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
      >
        <LogOut aria-hidden="true" />
        {logout.isPending ? 'Saindo…' : 'Sair'}
      </Button>
      <FormError error={logout.error} fallback="Não foi possível sair. Tente de novo." />
    </Section>
  );
}
