import { describe, expect, it } from 'vitest';
import {
  displayName,
  groupAssignmentsByEvent,
  groupTeamByFunction,
  keySource,
  resolveEventKey,
  splitByTime,
  type EventSummary,
  type MyAssignmentRow,
} from './schedule-utils';

const event = (id: string, starts_at: string, ends_at: string | null = null): EventSummary => ({
  id,
  type: 'culto',
  title: `Evento ${id}`,
  starts_at,
  ends_at,
  location: null,
  status: 'scheduled',
});

const vocal = { name: 'Vocal', sort_order: 3 };
const ministro = { name: 'Ministro', sort_order: 1 };
const violao = { name: 'Violão', sort_order: 5 };

describe('groupAssignmentsByEvent', () => {
  it('junta funções do mesmo evento na ordem do ministério', () => {
    const e1 = event('1', '2026-11-22T22:00:00Z');
    const rows: MyAssignmentRow[] = [
      { id: 'a', notes: null, event: e1, function: violao },
      { id: 'b', notes: ' levar capo ', event: e1, function: ministro },
      { id: 'c', notes: null, event: event('2', '2026-11-25T22:00:00Z'), function: vocal },
      { id: 'd', notes: null, event: null, function: vocal }, // evento invisível: ignora
    ];
    expect(groupAssignmentsByEvent(rows)).toEqual([
      { event: e1, functions: ['Ministro', 'Violão'], notes: ['levar capo'] },
      { event: expect.objectContaining({ id: '2' }), functions: ['Vocal'], notes: [] },
    ]);
  });
});

describe('splitByTime', () => {
  const now = new Date('2026-11-19T20:00:00Z');
  it('próximas em ordem crescente, anteriores da mais recente', () => {
    const items = [
      { event: event('futuro-longe', '2026-11-30T22:00:00Z') },
      { event: event('passado-longe', '2026-11-01T22:00:00Z') },
      { event: event('futuro-perto', '2026-11-20T22:00:00Z') },
      { event: event('passado-perto', '2026-11-18T22:00:00Z') },
      // Começou, mas ainda não terminou: continua em "próximas".
      { event: event('agora', '2026-11-19T19:00:00Z', '2026-11-19T21:00:00Z') },
    ];
    const { upcoming, past } = splitByTime(items, now);
    expect(upcoming.map((i) => i.event.id)).toEqual(['agora', 'futuro-perto', 'futuro-longe']);
    expect(past.map((i) => i.event.id)).toEqual(['passado-perto', 'passado-longe']);
  });
});

describe('groupTeamByFunction', () => {
  it('agrupa por função (ordem do ministério) e ordena nomes', () => {
    const person = (id: string, full_name: string, display_name: string | null = null) => ({
      id,
      full_name,
      display_name,
    });
    const groups = groupTeamByFunction([
      { id: '1', notes: null, profile: person('u1', 'Zélia Souza'), function: vocal },
      { id: '2', notes: 'abre o culto', profile: person('u2', 'Ana Lima'), function: ministro },
      { id: '3', notes: null, profile: person('u3', 'Bruno Alves', 'Bruninho'), function: vocal },
      { id: '4', notes: null, profile: person('u4', 'Ágata Reis'), function: vocal },
    ]);
    expect(groups.map((g) => [g.function, g.members.map((m) => m.name)])).toEqual([
      ['Ministro', ['Ana Lima']],
      ['Vocal', ['Ágata Reis', 'Bruninho', 'Zélia Souza']],
    ]);
    expect(groups[0]?.members[0]?.notes).toBe('abre o culto');
  });

  it('usa display_name quando existe', () => {
    expect(displayName({ full_name: 'Maria Silva', display_name: 'Mari' })).toBe('Mari');
    expect(displayName({ full_name: 'Maria Silva', display_name: '  ' })).toBe('Maria Silva');
  });
});

describe('tom do dia', () => {
  const song = { official_key: 'G', original_key: 'A' };
  it('prioriza tom do evento > oficial > original (mesma regra do get_dashboard)', () => {
    expect(resolveEventKey('D', song)).toBe('D');
    expect(resolveEventKey(null, song)).toBe('G');
    expect(resolveEventKey('', { official_key: null, original_key: 'A' })).toBe('A');
    expect(resolveEventKey(null, { official_key: null, original_key: null })).toBeNull();
  });

  it('informa de onde veio o tom', () => {
    expect(keySource('D', song)).toBe('event');
    expect(keySource(null, song)).toBe('official');
    expect(keySource(null, { official_key: null, original_key: 'A' })).toBe('original');
    expect(keySource(null, null)).toBeNull();
  });
});
