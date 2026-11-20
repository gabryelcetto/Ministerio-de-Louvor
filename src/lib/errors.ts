/**
 * Erros do Supabase/Postgres → mensagens em português para a interface. Único lugar do app que
 * traduz erro: telas e mutações chamam `friendlyError(error)`.
 */

/**
 * O RLS não dá erro num UPDATE/DELETE sem permissão: só afeta 0 linhas. Quem altera dados pede
 * `.select()` e chama `requireAffected()`, que lança este erro quando nada mudou.
 */
export class NoRowsAffectedError extends Error {
  constructor() {
    super('Nenhuma linha foi alterada (sem permissão ou registro inexistente).');
    this.name = 'NoRowsAffectedError';
  }
}

/** Erro cuja mensagem já está pronta para o usuário (ex.: resposta da Edge Function). */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

export function requireAffected<T>(rows: T[] | null | undefined): T[] {
  if (!rows || rows.length === 0) throw new NoRowsAffectedError();
  return rows;
}

const PERMISSION = 'Você não tem permissão para fazer essa alteração.';
const NETWORK = 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
const FALLBACK = 'Não foi possível concluir a operação. Tente de novo.';

/** Mensagens por nome de constraint (aparece na mensagem do Postgres). */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  event_assignments_event_id_user_id_function_id_key: 'Essa pessoa já está escalada nessa função.',
  event_songs_event_id_position_key: 'Já existe uma música nessa posição do repertório.',
  events_ends_after_starts: 'O término precisa ser depois do início.',
  event_songs_song_id_fkey: 'Esta música está no repertório de algum evento.',
};

interface ErrorLike {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

function readError(error: unknown): { code: string; message: string; details: string } {
  if (typeof error === 'string') return { code: '', message: error, details: '' };
  if (error && typeof error === 'object') {
    const e = error as ErrorLike;
    return {
      code: typeof e.code === 'string' ? e.code : '',
      message: typeof e.message === 'string' ? e.message : '',
      details: typeof e.details === 'string' ? e.details : '',
    };
  }
  return { code: '', message: '', details: '' };
}

/**
 * Mensagem escrita por nós num `raise exception` das migrations ("Sem permissão para…").
 * As mensagens nativas do Postgres/PostgREST vêm em inglês, sem acentos.
 */
function isOwnMessage(message: string): boolean {
  return /[À-ÿ]/u.test(message);
}

function sentence(message: string): string {
  const trimmed = message.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function friendlyError(error: unknown, fallback: string = FALLBACK): string {
  if (error instanceof NoRowsAffectedError) {
    return 'Nada foi salvo: você não tem permissão para isso ou o registro não existe mais.';
  }
  if (error instanceof UserFacingError) return error.message;
  const { code, message, details } = readError(error);
  const text = `${message} ${details}`;

  // Rede (fetch falhou antes de chegar ao banco).
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(text)) return NETWORK;

  // Sessão / autenticação.
  if (code === 'PGRST301' || code === 'PGRST303' || /jwt expired/i.test(text)) {
    return 'Sua sessão expirou. Entre de novo.';
  }
  if (/invalid login credentials/i.test(text)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(text)) return 'E-mail ainda não confirmado.';

  // Troca de senha (Supabase Auth).
  if (code === 'same_password' || /should be different from the old password/i.test(text)) {
    return 'A nova senha precisa ser diferente da atual.';
  }
  if (code === 'weak_password' || /password should (be|contain)/i.test(text)) {
    return 'Senha fraca: use pelo menos 10 caracteres, com letras e números.';
  }
  if (code === 'reauthentication_needed') {
    return 'Por segurança, saia e entre de novo antes de trocar a senha.';
  }

  // Constraint conhecida (unique, check, foreign key).
  for (const [name, friendly] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (text.includes(name)) return friendly;
  }

  switch (code) {
    case '42501': // insufficient_privilege: RLS, GRANT ou guarda de trigger
      if (/row-level security|permission denied/i.test(message)) return PERMISSION;
      return isOwnMessage(message) ? sentence(message) : PERMISSION;
    case 'P0001': // raise exception sem código
    case 'P0002': // no_data_found (ex.: "Versão não encontrada.")
      return isOwnMessage(message) ? sentence(message) : fallback;
    case '23505':
      return 'Esse registro já existe.';
    case '23503':
      return 'Há um registro relacionado que não existe ou ainda está em uso.';
    case '23514':
      return 'Algum valor informado não é válido.';
    case '23502':
      return 'Preencha todos os campos obrigatórios.';
    case '22P02':
    case '22007':
    case '22008':
      return 'Algum valor está num formato inválido.';
    case 'PGRST116':
      return 'Registro não encontrado.';
    default:
      return fallback;
  }
}
