/**
 * Edge Function `reset-member-password`: o admin redefine a senha de um integrante (que
 * esqueceu a senha, por exemplo). Não há "esqueci minha senha" por e-mail (sem SMTP).
 *
 * Ordem de segurança (como em invite-member):
 * 1. Valida o JWT de quem chamou — sem login, 401.
 * 2. `prepare_password_reset` COMO O USUÁRIO: o banco confere members.manage, que o alvo não é o
 *    dono, que admin só o dono redefine e que não é a própria senha — senão 403/400.
 * 3. Só então a service role (variável padrão das Edge Functions) troca a senha no Auth por uma
 *    senha provisória forte gerada aqui.
 * 4. `mark_password_reset` COMO O USUÁRIO: marca must_change_password = true (a pessoa é obrigada
 *    a trocar no próximo acesso) e registra em audit_logs.
 * 5. Encerra as sessões abertas da pessoa (revoke_user_sessions, só service role).
 * 6. Devolve a senha provisória UMA vez (Cache-Control: no-store). Ela vale 7 dias.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.119.1';
import { generatePassword } from '../_shared/password.ts';
import { parseResetInput, type ResetResult } from '../_shared/reset.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: ResetResult | { error: string }): Response {
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

/** Erro do banco → status HTTP + mensagem (as nossas têm acento e já estão em português). */
function fromDbError(error: { code?: string; message?: string }): Response {
  const own = /[À-ÿ]/u.test(error.message ?? '');
  const status =
    error.code === '42501'
      ? 403
      : error.code === 'P0002'
        ? 404
        : error.code === '22023'
          ? 400
          : 500;
  return fail(status, own ? (error.message as string) : 'Não foi possível redefinir a senha.');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return fail(405, 'Método não permitido.');

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return fail(401, 'Faça login para redefinir senhas.');

    const url = env('SUPABASE_URL');
    const asUser = createClient(url, env('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await asUser.auth.getUser(token);
    if (userError || !userData.user) return fail(401, 'Sua sessão expirou. Entre de novo.');

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(400, 'Dados inválidos.');
    }
    const parsed = parseResetInput(body);
    if (!parsed.ok) return fail(400, parsed.error);
    const { userId } = parsed.value;

    const { data: target, error: prepareError } = await asUser
      .rpc('prepare_password_reset', { p_user_id: userId })
      .single();
    if (prepareError || !target) return fromDbError(prepareError ?? {});

    const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const temporaryPassword = generatePassword();
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: temporaryPassword,
    });
    if (updateError) {
      console.error('reset-member-password: updateUserById', updateError.code, updateError.message);
      return fail(500, 'Não foi possível redefinir a senha. Tente de novo.');
    }

    const { error: markError } = await asUser.rpc('mark_password_reset', { p_user_id: userId });
    if (markError) {
      console.error(
        'reset-member-password: mark_password_reset',
        markError.code,
        markError.message,
      );
      return fail(
        500,
        'A senha foi trocada, mas não foi possível exigir a troca no próximo acesso. Tente de novo.',
      );
    }

    // Pendência 41: encerra as sessões abertas da pessoa. (O acesso ao banco já está bloqueado
    // por must_change_password; isto derruba também os refresh tokens.)
    const { error: revokeError } = await admin.rpc('revoke_user_sessions', { p_user_id: userId });
    if (revokeError) {
      console.error(
        'reset-member-password: revoke_user_sessions',
        revokeError.code,
        revokeError.message,
      );
    }

    const t = target as { full_name: string; display_name: string | null; email: string };
    return json(200, {
      userId,
      fullName: t.display_name?.trim() || t.full_name,
      email: t.email,
      temporaryPassword,
    });
  } catch (error) {
    console.error(
      'reset-member-password: erro inesperado',
      error instanceof Error ? error.message : error,
    );
    return fail(500, 'Não foi possível redefinir a senha. Tente de novo.');
  }
});
