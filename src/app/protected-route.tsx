import { Navigate, Outlet, useLocation } from 'react-router';
import { useMyProfile, useSession, signOut } from '@/features/auth';
import { Button } from '@/components/ui/button';
import { FirstAccessPage } from '@/features/auth/components/first-access-page';

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 p-4 text-center">
      {children}
    </main>
  );
}

/**
 * Guarda de rota: sem sessão → /login; perfil inativo → aviso; senha provisória → "Defina sua
 * senha" (bloqueia o app inteiro). Proteção real = RLS: no banco a conta também fica sem acesso.
 */
export function ProtectedRoute() {
  const { session, loading } = useSession();
  const location = useLocation();
  const profile = useMyProfile();

  if (loading || (session && profile.isPending)) {
    return (
      <FullScreenMessage>
        <p role="status" className="text-muted-foreground">
          Carregando…
        </p>
      </FullScreenMessage>
    );
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (profile.isError) {
    return (
      <FullScreenMessage>
        <p role="alert">Não foi possível carregar seu perfil.</p>
        <Button onClick={() => void profile.refetch()}>Tentar de novo</Button>
      </FullScreenMessage>
    );
  }
  if (profile.data?.status === 'inactive') {
    return (
      <FullScreenMessage>
        <h1 className="text-xl font-semibold">Acesso desativado</h1>
        <p className="text-muted-foreground">Fale com a liderança do ministério para reativar.</p>
        <Button variant="outline" onClick={() => void signOut()}>
          Sair
        </Button>
      </FullScreenMessage>
    );
  }
  if (profile.data?.must_change_password) {
    return (
      <FirstAccessPage
        name={profile.data.display_name || profile.data.full_name}
        expiresAt={profile.data.temp_password_expires_at}
      />
    );
  }
  return <Outlet />;
}
