/**
 * Edge Function `send-push` (Fase H, item 19): entrega uma notificação do app como aviso no
 * celular (Web Push com VAPID).
 *
 * Quem chama: o próprio banco, no trigger AFTER INSERT de notifications (pg_net), com o
 * cabeçalho `x-push-secret` = segredo `send_push_secret` do Vault. Não há usuário logado, por
 * isso verify_jwt = false no config.toml e a função confere o segredo (PUSH_WEBHOOK_SECRET)
 * antes de qualquer coisa. Sem o segredo certo: 401.
 *
 * Com o segredo certo, a service role lê a notificação e os aparelhos inscritos da pessoa
 * (nada vem do corpo além do id) e envia. Inscrição que volta 404/410 é apagada.
 *
 * Variáveis (o dono cadastra nos segredos das Edge Functions; nada no repositório):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex.: mailto:responsavel@exemplo.org),
 *   PUSH_WEBHOOK_SECRET. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.119.1';
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7';
import {
  isGoneStatus,
  parseDispatchBody,
  pushPayload,
  safeEqual,
  type NotificationRow,
} from '../_shared/push.ts';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  let secret: string;
  try {
    secret = env('PUSH_WEBHOOK_SECRET');
  } catch {
    return json(500, { error: 'Avisos no celular não configurados.' });
  }
  if (!safeEqual(req.headers.get('x-push-secret') ?? '', secret)) {
    return json(401, { error: 'Não autorizado.' });
  }

  const notificationId = parseDispatchBody(await req.json().catch(() => null));
  if (!notificationId) return json(400, { error: 'Notificação inválida.' });

  let config: { url: string; serviceKey: string };
  try {
    webpush.setVapidDetails(
      env('VAPID_SUBJECT'),
      env('VAPID_PUBLIC_KEY'),
      env('VAPID_PRIVATE_KEY'),
    );
    config = { url: env('SUPABASE_URL'), serviceKey: env('SUPABASE_SERVICE_ROLE_KEY') };
  } catch {
    return json(500, { error: 'Avisos no celular não configurados.' });
  }
  const admin = createClient(config.url, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: notification, error } = await admin
    .from('notifications')
    .select('id, user_id, type, title, body, link')
    .eq('id', notificationId)
    .maybeSingle<NotificationRow>();
  if (error) return json(500, { error: 'Não foi possível ler a notificação.' });
  if (!notification) return json(404, { error: 'Notificação não encontrada.' });

  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', notification.user_id);
  if (subsError) return json(500, { error: 'Não foi possível ler os aparelhos.' });

  const payload = JSON.stringify(pushPayload(notification));
  let sent = 0;
  const gone: string[] = [];
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 * 24, urgency: 'normal' },
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (isGoneStatus(status)) gone.push(sub.id);
      else console.error('send-push: falha ao enviar', status);
    }
  }
  if (gone.length > 0) await admin.from('push_subscriptions').delete().in('id', gone);

  return json(200, { sent, removed: gone.length });
});
