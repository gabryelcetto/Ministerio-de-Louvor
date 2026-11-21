import { describe, expect, it } from 'vitest';
import {
  addAll,
  audienceProblem,
  audienceSummary,
  emptyFilter,
  isPinned,
  joinList,
  parseAudienceFilter,
  pinnedUntil,
  recipientsLabel,
  seenLabel,
  toggleId,
} from './audience';

const UUID = '10000000-0000-4000-8000-000000000002';

describe('público do comunicado', () => {
  it('lê o filtro do banco e cai em "Todos" quando vem estranho', () => {
    expect(parseAudienceFilter({ type: 'users', user_ids: [UUID] })).toEqual({
      type: 'users',
      user_ids: [UUID],
    });
    expect(parseAudienceFilter({ type: 'groups', sections: ['vocal'] })).toEqual({
      type: 'groups',
      sections: ['vocal'],
      function_ids: [],
    });
    expect(parseAudienceFilter({ type: 'event', event_id: 'x' })).toEqual({ type: 'all' });
    expect(parseAudienceFilter(null)).toEqual({ type: 'all' });
    expect(parseAudienceFilter({ type: 'outro' })).toEqual({ type: 'all' });
  });

  it('filtro vazio por tipo e o que falta escolher', () => {
    expect(emptyFilter('all')).toEqual({ type: 'all' });
    expect(audienceProblem(emptyFilter('all'))).toBeNull();
    expect(audienceProblem(emptyFilter('groups'))).toBe('Escolha pelo menos um grupo ou função.');
    expect(audienceProblem({ type: 'groups', sections: [], function_ids: [3] })).toBeNull();
    expect(audienceProblem({ type: 'groups', sections: ['vocal'], function_ids: [] })).toBeNull();
    expect(audienceProblem(emptyFilter('event'))).toBe('Escolha o evento.');
    expect(audienceProblem({ type: 'event', event_id: UUID })).toBeNull();
    expect(audienceProblem(emptyFilter('users'))).toBe('Escolha pelo menos uma pessoa.');
    expect(audienceProblem({ type: 'users', user_ids: [UUID] })).toBeNull();
  });

  it('contagem: "Vai para N pessoas" e "Visto por N de M"', () => {
    expect(recipientsLabel(0)).toBe('Ninguém recebe ainda');
    expect(recipientsLabel(-1)).toBe('Ninguém recebe ainda');
    expect(recipientsLabel(1)).toBe('Vai para 1 pessoa');
    expect(recipientsLabel(12)).toBe('Vai para 12 pessoas');
    expect(seenLabel(8, 12)).toBe('Visto por 8 de 12');
  });

  it('resumo do público', () => {
    const functions = new Map([[7, 'Bateria']]);
    const events = new Map([[UUID, 'Culto de domingo']]);
    expect(audienceSummary({ type: 'all' })).toBe('Todos');
    expect(
      audienceSummary({ type: 'groups', sections: ['vocal'], function_ids: [7] }, { functions }),
    ).toBe('Cantores e Bateria');
    expect(audienceSummary({ type: 'groups', sections: [], function_ids: [9] })).toBe('uma função');
    expect(audienceSummary({ type: 'event', event_id: UUID }, { events })).toBe(
      'Escalados: Culto de domingo',
    );
    expect(audienceSummary({ type: 'event', event_id: UUID })).toBe('Escalados: um evento');
    expect(audienceSummary({ type: 'users', user_ids: [UUID] })).toBe('1 pessoa');
    expect(audienceSummary({ type: 'users', user_ids: [UUID, 'b'] })).toBe('2 pessoas');
  });

  it('listas: juntar, marcar e "selecionar todos do resultado"', () => {
    expect(joinList([])).toBe('');
    expect(joinList(['a'])).toBe('a');
    expect(joinList(['a', 'b'])).toBe('a e b');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b e c');
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
    expect(addAll(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('fixar no topo', () => {
    const now = new Date('2026-11-22T12:00:00Z');
    expect(pinnedUntil('none', now)).toBeNull();
    expect(pinnedUntil('7', now)).toBe('2026-11-29T12:00:00.000Z');
    expect(pinnedUntil('3', now)).toBe('2026-11-25T12:00:00.000Z');
    expect(isPinned('2026-11-29T12:00:00.000Z', now)).toBe(true);
    expect(isPinned('2026-11-21T12:00:00.000Z', now)).toBe(false);
    expect(isPinned(null, now)).toBe(false);
  });
});
