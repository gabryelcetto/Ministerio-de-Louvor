import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { FormError } from '@/components/common/form-error';
import { Button } from '@/components/ui/button';
import { signOut } from '@/features/auth';
import { PRIVACY_VERSION } from '@/lib/privacy';
import { supabase } from '@/services/supabase';

/** Primeiro acesso: "Li e concordo" com a política (grava data e versão no perfil). */
export function PrivacyConsent() {
  const id = useId();
  const client = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const accept = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('accept_privacy', { p_version: PRIVACY_VERSION });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['me'] }),
  });
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-4">
      <ShieldCheck aria-hidden="true" className="size-10 self-center text-brand-text" />
      <h1 className="text-center text-screen-title">Seus dados no app</h1>
      <p className="text-sm text-muted-foreground">
        Guardamos nome, telefone, funções, escalas e gravações só para organizar o ministério.{' '}
        <Link to="/privacidade" className="font-semibold text-brand-text underline">
          Ler a política de privacidade
        </Link>
      </p>
      <label htmlFor={id} className="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input
          id={id}
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        Li e concordo
      </label>
      <FormError error={accept.error} />
      <Button type="button" disabled={!agreed || accept.isPending} onClick={() => accept.mutate()}>
        {accept.isPending ? 'Salvando…' : 'Continuar'}
      </Button>
      <Button type="button" variant="ghost" onClick={() => void signOut()}>
        Sair
      </Button>
    </main>
  );
}
