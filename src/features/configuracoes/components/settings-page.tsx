import type { ReactNode } from 'react';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScreenHeader } from '@/components/layout/screen-header';
import { ThemeOptions } from '@/components/theme/theme-options';
import { PasswordForm, useMyProfile, useSession } from '@/features/auth';
import { StorageUsageCard } from '@/features/audio';
import { InstallButton } from '@/features/instalar';
import { ROLE_LABEL, useMyFunctions } from '@/features/integrantes';
import { useScrollToHash } from '@/hooks/use-scroll-to-hash';
import { useTheme } from '@/hooks/use-theme';

/**
 * Configurações pessoais: aparência (tema), minha conta (perfil e senha), instalação do app e
 * espaço dos áudios (admin). Sair fica só em Mais, no fim da lista.
 */
export function SettingsPage() {
  useScrollToHash();
  return (
    <>
      <ScreenHeader title="Configurações" back="/mais" />
      <section className="mx-auto flex max-w-2xl flex-col gap-5">
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
    </>
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
  const profile = useMyProfile();
  const myFunctions = useMyFunctions();
  const functionNames = myFunctions.data?.map((f) => f.name) ?? [];

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
            {myFunctions.isPending ? (
              <span className="text-muted-foreground">Carregando…</span>
            ) : myFunctions.isError ? (
              <button
                type="button"
                onClick={() => void myFunctions.refetch()}
                className="rounded text-destructive underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Não foi possível carregar. Tentar de novo
              </button>
            ) : functionNames.length === 0 ? (
              <span className="text-muted-foreground">Nenhuma função definida</span>
            ) : (
              <span className="flex flex-wrap gap-1.5">
                {functionNames.map((fn) => (
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
