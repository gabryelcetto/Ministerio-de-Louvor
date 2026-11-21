import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/supabase', () => ({ supabase: {} }));

const notif = await import('./api');

describe('notificações', () => {
  it('só segue links internos do app', () => {
    expect(notif.internalLink('/escalas/123')).toBe('/escalas/123');
    expect(notif.internalLink('//site-externo.com')).toBeNull();
    expect(notif.internalLink('https://site-externo.com')).toBeNull();
    expect(notif.internalLink(null)).toBeNull();
  });

  it('texto do contador', () => {
    expect(notif.unreadLabel(0)).toBe('Nenhuma notificação nova');
    expect(notif.unreadLabel(1)).toBe('1 notificação não lida');
    expect(notif.unreadLabel(4)).toBe('4 notificações não lidas');
  });
});
