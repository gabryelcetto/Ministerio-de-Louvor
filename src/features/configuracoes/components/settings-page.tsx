import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeOptions } from '@/components/theme/theme-options';
import { PasswordForm, useMyProfile, useSession } from '@/features/auth';
import { StorageUsageCard } from '@/features/audio';
import { InstallButton } from '@/features/instalar';
import { ROLE_LABEL } from '@/features/integrantes';
import { supabase } from '@/services/supabase';
import { useTheme } from '@/hooks/use-theme';

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

/**
 * Configurações pessoais: aparência (tema), minha conta (perfil e senha), instalação do app e
 * espaço dos áudios (admin). Sair fica só em Mais, no fim da lista.
 */
export function SettingsPage() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-screen-title">Configurações</h1>
      <ThemeCard />
      <ProfileCard />
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
    </section>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-20">
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
    <Section title="Minha conta" id="minha-conta">
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

function ThemeCard() {
  const { pref, setPref } = useTheme();
  return (
    <Section title="Aparência" id="aparencia">
      <ThemeOptions value={pref} onChange={setPref} name="tema" />
      <p className="text-caption text-muted-foreground">
        "Automático" segue o tema do celular. A escolha vale para este aparelho.
      </p>
    </Section>
  );
}
