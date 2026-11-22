import { describe, expect, it } from 'vitest';
import {
  isGoneStatus,
  parseDispatchBody,
  pushPayload,
  safeAppPath,
  safeEqual,
} from '../../supabase/functions/_shared/push.ts';
import {
  isIos,
  parsePushMessage,
  pushAvailability,
  readVapidPublicKey,
  urlBase64ToUint8Array,
  type PushEnvironment,
} from './push';

const KEY = 'B' + 'A'.repeat(86);

describe('Web Push no app', () => {
  it('chave VAPID pública: só base64url do tamanho certo', () => {
    expect(readVapidPublicKey({ VITE_VAPID_PUBLIC_KEY: ` ${KEY} ` })).toBe(KEY);
    expect(readVapidPublicKey({ VITE_VAPID_PUBLIC_KEY: '' })).toBeNull();
    expect(readVapidPublicKey({ VITE_VAPID_PUBLIC_KEY: 'curta' })).toBeNull();
    expect(readVapidPublicKey({ VITE_VAPID_PUBLIC_KEY: `${KEY.slice(1)}+` })).toBeNull();
    expect(readVapidPublicKey({})).toBeNull();
  });

  it('converte base64url em bytes', () => {
    expect([...urlBase64ToUint8Array('AQID')]).toEqual([1, 2, 3]);
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255]);
    expect(urlBase64ToUint8Array(KEY)).toHaveLength(65);
  });

  it('reconhece iPhone, iPad e iPad que se passa por Mac', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIos('Mozilla/5.0 (Linux; Android 14)')).toBe(false);
  });

  it('quando mostrar a opção', () => {
    const base: PushEnvironment = {
      hasKey: true,
      userAgent: 'Android',
      standalone: false,
      hasServiceWorker: true,
      hasPushManager: true,
      hasNotification: true,
    };
    expect(pushAvailability({ ...base, hasKey: false })).toBe('hidden');
    expect(pushAvailability(base)).toBe('available');
    expect(pushAvailability({ ...base, hasPushManager: false })).toBe('unsupported');
    expect(pushAvailability({ ...base, hasServiceWorker: false })).toBe('unsupported');
    expect(pushAvailability({ ...base, hasNotification: false })).toBe('unsupported');
    expect(pushAvailability({ ...base, userAgent: 'iPhone' })).toBe('ios-install');
    expect(pushAvailability({ ...base, userAgent: 'iPhone', standalone: true })).toBe('available');
  });

  it('aviso recebido: só abre caminhos internos', () => {
    expect(
      parsePushMessage({ title: 'Escala', body: 'Domingo', url: '/escalas/1', tag: 't' }),
    ).toEqual({ title: 'Escala', body: 'Domingo', url: '/escalas/1', tag: 't' });
    expect(parsePushMessage({ url: 'https://malicioso.example' })).toEqual({
      title: 'Ministério de Louvor',
      body: '',
      url: '/',
    });
    expect(parsePushMessage({ url: '//malicioso.example' }).url).toBe('/');
    expect(parsePushMessage(null).url).toBe('/');
    expect(parsePushMessage({ title: 5 }).title).toBe('Ministério de Louvor');
  });
});

describe('Edge Function send-push (regras puras)', () => {
  const row = {
    id: '11111111-2222-4333-8444-555555555555',
    user_id: 'u',
    type: 'assignment_added',
    title: ' Você foi escalado(a) ',
    body: 'x'.repeat(200),
    link: '/escalas/e1',
  };

  it('monta o aviso com texto curto, link interno e uma tag por notificação', () => {
    const p = pushPayload(row);
    expect(p.title).toBe('Você foi escalado(a)');
    expect(p.body).toHaveLength(180);
    expect(p.body.endsWith('…')).toBe(true);
    expect(p.url).toBe('/escalas/e1');
    expect(p.tag).toBe(`notificacao-${row.id}`);
    expect(pushPayload({ ...row, title: ' ', body: null, link: null })).toMatchObject({
      title: 'Ministério de Louvor',
      body: '',
      url: '/',
    });
    expect(pushPayload({ ...row, body: 'curto' }).body).toBe('curto');
  });

  it('caminhos seguros', () => {
    expect(safeAppPath('/comunicados/1')).toBe('/comunicados/1');
    expect(safeAppPath('https://x')).toBe('/');
    expect(safeAppPath('//x')).toBe('/');
    expect(safeAppPath(undefined)).toBe('/');
  });

  it('apaga a inscrição só em 404 e 410', () => {
    expect(isGoneStatus(404)).toBe(true);
    expect(isGoneStatus(410)).toBe(true);
    expect(isGoneStatus(500)).toBe(false);
    expect(isGoneStatus(undefined)).toBe(false);
  });

  it('segredo e corpo do disparo', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
    expect(parseDispatchBody({ notification_id: row.id })).toBe(row.id);
    expect(parseDispatchBody({ notification_id: 'x' })).toBeNull();
    expect(parseDispatchBody({ notification_id: 1 })).toBeNull();
    expect(parseDispatchBody(null)).toBeNull();
    expect(parseDispatchBody('texto')).toBeNull();
  });
});
