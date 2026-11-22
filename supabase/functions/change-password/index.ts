/**
 * Edge Function `change-password`: troca a senha e libera a conta NUMA operação (pendência 30).
 *
 * Ordem de segurança:
 * 1. Valida o JWT de quem chamou — sem login, 401.
 * 2. Lê o próprio perfil COMO O USUÁRIO (RLS): troca obrigatória (primeiro acesso / senha
 *    redefinida) ou troca normal. Provisória vencida (7 dias) → 403 com a explicação.
 * 3. Troca normal: confere a senha atual (login com e-mail + senha atual num cliente à parte).
 * 4. Só então a service role troca a senha no Auth e chama finish_password_change(), que só ela
 *    executa (o usuário não consegue se liberar sem trocar a senha de verdade).
 */
import { createClient } from 'npm:@supabase/supabase-js@2.119.1';
import {
  changeRequirement,
  EXPIRED_MESSAGE,
  parseChangePasswordInput,
} from '../_shared/change-password.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: { ok: true } | { error: string }): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
const fail = (status: number, error: string) => json(status, { error });

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return fail(405, 'Método não permitido.');

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return fail(401, 'Faça login para trocar a senha.');

    const url = env('SUPABASE_URL');
    const anonKey = env('SUPABASE_ANON_KEY');
    const asUser = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await asUser.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) return fail(401, 'Sua sessão expirou. Entre de novo.');

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(400, 'Dados inválidos.');
    }
    const parsed = parseChangePasswordInput(body);
    if (!parsed.ok) return fail(400, parsed.error);
    const { password, currentPassword } = parsed.value;

    // O próprio perfil, lido como o usuário (o RLS deixa cada um ler o seu, mesmo bloqueado).
    const { data: profile, error: profileError } = await asUser
      .from('profiles')
      .select('must_change_password, temp_password_expires_at')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) return fail(403, 'Conta sem acesso. Fale com um administrador.');

    const requirement = changeRequirement(
      profile as { must_change_password: boolean; temp_password_expires_at: string | null },
    );
    if (requirement === 'expired') return fail(403, EXPIRED_MESSAGE);

    if (requirement === 'needs-current') {
      if (!currentPassword) return fail(400, 'Informe a senha atual.');
      if (!user.email) return fail(400, 'Conta sem e-mail. Fale com um administrador.');
      // Cliente à parte: confere a senha atual sem mexer na sessão de quem chamou.
      const checker = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: signInError } = await checker.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) return fail(400, 'A senha atual está incorreta.');
    }

    const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { password });
    if (updateError) {
      if (
        updateError.code === 'same_password' ||
        /different from the old password/i.test(updateError.message)
      ) {
        return fail(400, 'A nova senha precisa ser diferente da atual.');
      }
      console.error('change-password: updateUserById', updateError.code, updateError.message);
      return fail(500, 'Não foi possível trocar a senha. Tente de novo.');
    }

    const { error: finishError } = await admin.rpc('finish_password_change', {
      p_user_id: user.id,
    });
    if (finishError) {
      console.error(
        'change-password: finish_password_change',
        finishError.code,
        finishError.message,
      );
      return fail(500, 'A senha foi trocada, mas não foi possível liberar a conta. Tente de novo.');
    }
    return json(200, { ok: true });
  } catch (error) {
    console.error(
      'change-password: erro inesperado',
      error instanceof Error ? error.message : error,
    );
    return fail(500, 'Não foi possível trocar a senha. Tente de novo.');
  }
});
