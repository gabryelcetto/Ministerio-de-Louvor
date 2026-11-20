/**
 * Edge Function `invite-member`: cadastra um integrante (o cadastro público continua desligado).
 *
 * Ordem de segurança:
 * 1. Valida o JWT de quem chamou (auth.getUser) — sem login, 401.
 * 2. Confere `has_permission('members.manage')` chamando o banco COMO ESSE USUÁRIO — sem
 *    permissão, 403. Perfil líder/admin exige também `permissions.manage`.
 * 3. Só então usa a service role (variável padrão SUPABASE_SERVICE_ROLE_KEY, que só existe no
 *    servidor) para `auth.admin.createUser` com e-mail confirmado e senha provisória forte.
 * 4. Grava nome, funções e perfil pela RPC `setup_new_member`, de novo COMO O USUÁRIO: o banco
 *    confere as permissões outra vez e marca `must_change_password = true`. Se falhar, a conta
 *    criada no passo 3 é apagada (nada fica pela metade).
 * 5. Devolve a senha provisória uma única vez (resposta com Cache-Control: no-store).
 *
 * Deploy: `npx supabase functions deploy invite-member` (ver README).
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.119.1';
import { type InviteError, type InviteResult, parseInviteInput } from '../_shared/invite.ts';
import { generatePassword } from '../_shared/password.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: InviteResult | InviteError): Response {
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

async function hasPermission(client: SupabaseClient, key: string): Promise<boolean> {
  const { data, error } = await client.rpc('has_permission', { p: key });
  if (error) throw error;
  return data === true;
}

function isDuplicateEmail(error: { code?: string; message?: string; status?: number }): boolean {
  return (
    error.code === 'email_exists' ||
    error.code === 'user_already_exists' ||
    /already (been )?registered|already exists/i.test(error.message ?? '')
  );
}

/** Mensagens do banco escritas por nós (com acento) passam; o resto vira genérica. */
function dbMessage(error: { message?: string }, fallback: string): string {
  const message = error.message ?? '';
  return /[À-ÿ]/u.test(message) ? message : fallback;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return fail(405, 'Método não permitido.');

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return fail(401, 'Faça login para cadastrar integrantes.');

    const url = env('SUPABASE_URL');
    // Cliente "como o usuário": tudo que ele fizer passa pelo RLS e pelas regras do banco.
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
      return fail(400, 'Dados do cadastro inválidos.');
    }
    const parsed = parseInviteInput(body);
    if (!parsed.ok) return fail(400, parsed.error);
    const input = parsed.value;

    if (!(await hasPermission(asUser, 'members.manage'))) {
      return fail(403, 'Você não tem permissão para cadastrar integrantes.');
    }
    if (input.accessRole !== 'member' && !(await hasPermission(asUser, 'permissions.manage'))) {
      return fail(403, 'Só quem gerencia permissões pode cadastrar líderes ou administradores.');
    }

    // A partir daqui, e só para o Auth admin: service role (nunca sai do servidor).
    const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const temporaryPassword = generatePassword();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: input.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: input.fullName, display_name: input.displayName },
    });
    if (createError || !created.user) {
      if (createError && isDuplicateEmail(createError)) {
        return fail(409, 'Já existe uma conta com este e-mail.');
      }
      console.error('invite-member: createUser falhou', createError?.code, createError?.message);
      return fail(500, 'Não foi possível criar a conta. Tente de novo.');
    }

    const { error: setupError } = await asUser.rpc('setup_new_member', {
      p_user_id: created.user.id,
      p_full_name: input.fullName,
      p_display_name: input.displayName ?? '',
      p_access_role: input.accessRole,
      p_function_ids: input.functionIds,
    });
    if (setupError) {
      // Desfaz: sem perfil configurado, a conta não deve existir.
      await admin.auth.admin.deleteUser(created.user.id);
      console.error('invite-member: setup_new_member falhou', setupError.code, setupError.message);
      const status = setupError.code === '42501' ? 403 : setupError.code === '23503' ? 400 : 500;
      const fallback =
        setupError.code === '23503'
          ? 'Alguma função do ministério escolhida não existe mais.'
          : 'Não foi possível concluir o cadastro. Tente de novo.';
      return fail(status, dbMessage(setupError, fallback));
    }

    return json(201, {
      userId: created.user.id,
      fullName: input.fullName,
      email: input.email,
      temporaryPassword,
    });
  } catch (error) {
    console.error('invite-member: erro inesperado', error instanceof Error ? error.message : error);
    return fail(500, 'Não foi possível concluir o cadastro. Tente de novo.');
  }
});
