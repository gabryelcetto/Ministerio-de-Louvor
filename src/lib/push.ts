/**
 * Web Push no app (Fase H, item 19): quando mostrar "Receber avisos no celular" e como converter
 * a chave pública VAPID. Sem React e sem Supabase (testável).
 */

/** Chave pública VAPID (base64url, 65 bytes → 87 caracteres). Ausente: a opção fica escondida. */
export function readVapidPublicKey(raw: Record<string, unknown>): string | null {
  const value = raw.VITE_VAPID_PUBLIC_KEY;
  if (typeof value !== 'string') return null;
  const key = value.trim();
  return /^[A-Za-z0-9_-]{80,100}$/.test(key) ? key : null;
}

/** base64url → bytes (applicationServerKey do pushManager.subscribe). */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function isIos(userAgent: string, maxTouchPoints = 0): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export type PushAvailability =
  /** Sem chave VAPID no build: a opção não aparece. */
  | 'hidden'
  /** Navegador sem Web Push. */
  | 'unsupported'
  /** iPhone/iPad: só funciona com o app instalado na tela inicial (iOS 16.4+). */
  | 'ios-install'
  | 'available';

export interface PushEnvironment {
  hasKey: boolean;
  userAgent: string;
  maxTouchPoints?: number;
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
}

export function pushAvailability(env: PushEnvironment): PushAvailability {
  if (!env.hasKey) return 'hidden';
  if (isIos(env.userAgent, env.maxTouchPoints) && !env.standalone) return 'ios-install';
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'unsupported';
  return 'available';
}

/** Aviso a mostrar (vindo da Edge Function send-push). */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/** Lê o conteúdo do evento `push` sem confiar nele: só caminhos internos do app. */
export function parsePushMessage(data: unknown): PushMessage {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const url = text(d.url);
  return {
    title: text(d.title) || 'Ministério de Louvor',
    body: text(d.body),
    url: url.startsWith('/') && !url.startsWith('//') ? url : '/',
    ...(text(d.tag) ? { tag: text(d.tag) } : {}),
  };
}
