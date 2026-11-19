import type { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';

export interface SessionState {
  session: Session | null;
  /** true enquanto a sessão salva no navegador ainda está sendo lida. */
  loading: boolean;
}

export const SessionContext = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession precisa estar dentro de <SessionProvider>');
  return value;
}
