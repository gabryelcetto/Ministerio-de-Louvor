import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { shouldClearCache } from './session-cache';
import { SessionContext } from './session-context';

/** Mantém a sessão do Supabase Auth em memória e reage a login/logout/refresh. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  // Dono dos dados em cache (para saber se a "nova" sessão é de outra pessoa).
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      userIdRef.current = data.session?.user.id ?? null;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      const nextUserId = newSession?.user.id ?? null;
      // Saiu ou trocou de usuário: nenhum dado do usuário anterior pode ficar em cache.
      if (shouldClearCache(event, userIdRef.current, nextUserId)) queryClient.clear();
      userIdRef.current = nextUserId;
      setSession(newSession);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  return <SessionContext.Provider value={{ session, loading }}>{children}</SessionContext.Provider>;
}
