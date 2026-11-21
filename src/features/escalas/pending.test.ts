import { describe, expect, it } from 'vitest';
import { eventIssues, type IssueInput } from './pending';

const now = new Date('2026-11-22T12:00:00Z');
const base: IssueInput = {
  type: 'culto',
  status: 'scheduled',
  startsAt: '2026-11-25T22:00:00Z',
  teamCount: 3,
  songCount: 4,
};

describe('pendências do evento (visão do admin)', () => {
  it('sem pendência', () => {
    expect(eventIssues(base, now)).toEqual([]);
  });

  it('sem equipe, sem repertório (só culto) e recusas', () => {
    expect(eventIssues({ ...base, teamCount: 0, songCount: 0 }, now)).toEqual([
      'Sem equipe',
      'Sem repertório',
    ]);
    expect(eventIssues({ ...base, type: 'ensaio', songCount: 0 }, now)).toEqual([]);
    expect(eventIssues({ ...base, type: 'evento', teamCount: 0, songCount: 0 }, now)).toEqual([
      'Sem equipe',
    ]);
    expect(eventIssues({ ...base, declinedCount: 1 }, now)).toEqual(['1 recusa']);
    expect(eventIssues({ ...base, declinedCount: 2 }, now)).toEqual(['2 recusas']);
  });

  it('cancelado ou já passado: nada a resolver', () => {
    expect(eventIssues({ ...base, status: 'cancelled', teamCount: 0 }, now)).toEqual([]);
    expect(eventIssues({ ...base, startsAt: '2026-11-20T22:00:00Z', teamCount: 0 }, now)).toEqual(
      [],
    );
  });
});
