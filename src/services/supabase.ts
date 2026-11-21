import { createClient } from '@supabase/supabase-js';
import type { AppDatabase } from '@/types/app.types';
import { readPublicEnv } from '@/lib/env';
import { fetchWithTimeout } from '@/lib/network';

/**
 * Cliente Supabase ÚNICO da aplicação. Importe sempre daqui.
 * Usa só a chave pública (publishable): quem protege os dados é o RLS no banco.
 * Se faltar alguma variável, readPublicEnv lança um erro explicando o que fazer.
 * Toda chamada tem tempo limite e falha na hora sem internet (src/lib/network.ts): a pessoa vê
 * "Sem conexão. Tente de novo." em vez de esperar em "Salvando…".
 */
const env = readPublicEnv(import.meta.env);

export const supabase = createClient<AppDatabase>(env.supabaseUrl, env.supabasePublishableKey, {
  global: { fetch: fetchWithTimeout((...args) => fetch(...args)) },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
