/**
 * Regras puras do Web Push (Fase H, item 19), usadas pela Edge Function send-push e testadas
 * no Vitest. Sem Deno e sem React.
 */

/** Notificação como está no banco (public.notifications). */
export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
}

/** O que o service worker recebe no evento `push`. */
export interface PushPayload {
  title: string;
  body: string;
  /** Caminho dentro do app aberto ao tocar no aviso. */
  url: string;
  /** Avisos com a mesma tag se substituem no celular (um por notificação). */
  tag: string;
}

const BODY_MAX = 180;

/** Só caminhos internos (começando com "/"); qualquer outra coisa abre o Início. */
export function safeAppPath(link: string | null | undefined): string {
  if (!link || !link.startsWith('/') || link.startsWith('//')) return '/';
  return link;
}

export function pushPayload(n: NotificationRow): PushPayload {
  const body = (n.body ?? '').trim();
  return {
    title: n.title.trim() || 'Ministério de Louvor',
    body: body.length > BODY_MAX ? `${body.slice(0, BODY_MAX - 1)}…` : body,
    url: safeAppPath(n.link),
    tag: `notificacao-${n.id}`,
  };
}

/** O serviço de push respondeu que a inscrição não existe mais: apagar. */
export function isGoneStatus(status: number | undefined): boolean {
  return status === 404 || status === 410;
}

/** Comparação em tempo constante (o segredo do Vault não vaza pelo tempo de resposta). */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Corpo esperado do disparo feito pelo banco (trigger dispatch_push via pg_net). */
export function parseDispatchBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const id = (body as { notification_id?: unknown }).notification_id;
  return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}
