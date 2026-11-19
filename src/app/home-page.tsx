import { useMyProfile } from '@/features/auth/hooks/use-me';

/** Início provisório (o Dashboard via get_dashboard chega na fase E). */
export function HomePage() {
  const { data: profile } = useMyProfile();
  const name = profile?.display_name || profile?.full_name;
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{name ? `Olá, ${name}!` : 'Olá!'}</h1>
      <p className="text-muted-foreground">
        Bem-vindo(a) ao Ministério de Louvor. O painel com próximas escalas e repertório chega na
        próxima fase.
      </p>
    </section>
  );
}
