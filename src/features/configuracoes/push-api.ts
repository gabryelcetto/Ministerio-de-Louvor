import { readVapidPublicKey, pushAvailability, urlBase64ToUint8Array } from '@/lib/push';
import { supabase } from '@/services/supabase';

export const VAPID_PUBLIC_KEY = readVapidPublicKey(import.meta.env);

export function currentPushAvailability() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return pushAvailability({
    hasKey: VAPID_PUBLIC_KEY !== null,
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints,
    standalone:
      nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true,
    hasServiceWorker: 'serviceWorker' in nav,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
  });
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready;
}

/** Este aparelho já recebe avisos? */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  return (await registration()).pushManager.getSubscription();
}

/** Pede permissão, inscreve o aparelho e guarda no banco. */
export async function enablePush(): Promise<void> {
  if (!VAPID_PUBLIC_KEY) throw new Error('Avisos no celular não configurados.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      'O celular não deu permissão para avisos. Libere as notificações do app nas configurações do aparelho.',
    );
  }
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));
  const json = sub.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw error;
}

/** Para de receber neste aparelho (apaga do banco e cancela no navegador). */
export async function disablePush(): Promise<void> {
  const sub = await getPushSubscription();
  if (!sub) return;
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  if (error) throw error;
  await sub.unsubscribe();
}
