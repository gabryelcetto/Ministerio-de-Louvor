import { describe, expect, it, vi } from 'vitest';

// api.ts importa o cliente Supabase, que valida as variáveis de ambiente ao carregar.
vi.mock('@/services/supabase', () => ({ supabase: {} }));

const { groupDashboardAssignments, parseDashboard } = await import('./api');

describe('parseDashboard', () => {
  it('devolve um painel vazio quando o retorno não é um objeto', () => {
    for (const raw of [null, [], 'x', 1]) {
      expect(parseDashboard(raw)).toEqual({
        next_service: null,
        next_rehearsal: null,
        my_assignments: [],
        next_service_songs: [],
        recent_announcements: [],
        unread_notifications: 0,
      });
    }
  });

  it('normaliza listas nulas, contador e ordem do repertório', () => {
    const parsed = parseDashboard({
      next_service: null,
      my_assignments: null,
      next_service_songs: [
        { song_id: 'b', title: 'B', artist: null, position: 2, key: 'D' },
        { song_id: 'a', title: 'A', artist: null, position: 1, key: 'G' },
      ],
      recent_announcements: [],
      unread_notifications: '3',
    });
    expect(parsed.my_assignments).toEqual([]);
    expect(parsed.next_service_songs.map((s) => s.song_id)).toEqual(['a', 'b']);
    expect(parsed.unread_notifications).toBe(3);
  });
});

describe('groupDashboardAssignments', () => {
  it('uma linha por evento, com todas as funções', () => {
    const base = {
      event_title: 'Culto',
      event_type: 'culto' as const,
      location: null,
    };
    const items = groupDashboardAssignments([
      {
        ...base,
        assignment_id: '1',
        event_id: 'e2',
        starts_at: '2026-11-29T13:00:00Z',
        function: 'Vocal',
      },
      {
        ...base,
        assignment_id: '2',
        event_id: 'e1',
        starts_at: '2026-11-22T22:00:00Z',
        function: 'Ministro',
      },
      {
        ...base,
        assignment_id: '3',
        event_id: 'e1',
        starts_at: '2026-11-22T22:00:00Z',
        function: 'Violão',
      },
    ]);
    expect(items.map((i) => [i.eventId, i.functions])).toEqual([
      ['e1', ['Ministro', 'Violão']],
      ['e2', ['Vocal']],
    ]);
  });
});
