import { createClient } from '@supabase/supabase-js';
import { readPublicEnv } from './env';

/**
 * Cliente Supabase ÚNICO da aplicação. Importe sempre daqui.
 * Usa só a chave pública (publishable): quem protege os dados é o RLS no banco.
 * Se faltar alguma variável, readPublicEnv lança um erro explicando o que fazer.
 */
const env = readPublicEnv(import.meta.env);

export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
