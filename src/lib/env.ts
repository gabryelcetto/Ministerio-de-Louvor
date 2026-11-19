/**
 * Leitura e validação das variáveis de ambiente públicas do frontend.
 * Separado do cliente Supabase para poder ser testado sem rede.
 */
export interface PublicEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

type RawEnv = Record<string, unknown>;

export class MissingEnvError extends Error {
  constructor(missing: string[]) {
    super(
      `Variáveis de ambiente ausentes: ${missing.join(', ')}. ` +
        'Copie .env.example para .env.local e preencha com os dados do seu projeto Supabase ' +
        '(Painel → Project Settings → API).',
    );
    this.name = 'MissingEnvError';
  }
}

function readString(raw: RawEnv, name: string): string | undefined {
  const value = raw[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export function readPublicEnv(raw: RawEnv): PublicEnv {
  const supabaseUrl = readString(raw, 'VITE_SUPABASE_URL');
  const supabasePublishableKey = readString(raw, 'VITE_SUPABASE_PUBLISHABLE_KEY');

  const missing: string[] = [];
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!supabasePublishableKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!supabaseUrl || !supabasePublishableKey) throw new MissingEnvError(missing);

  if (!URL.canParse(supabaseUrl)) {
    throw new Error(
      `VITE_SUPABASE_URL inválida: "${supabaseUrl}". Esperado algo como https://xyz.supabase.co`,
    );
  }
  return { supabaseUrl, supabasePublishableKey };
}
