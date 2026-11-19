import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
const { assignmentsToInsert, draftProblems, functionOptions, validateEventDraft } =
  await import('./manage');

const row = (key: string, userId: string, functionId: number | null, notes = '') => ({
  key,
  userId,
  functionId,
  notes,
});
const event = {
  type: 'culto' as const,
  title: 'Culto',
  startsAt: '2026-11-29T19:00',
  endsAt: '',
  location: '',
  notes: '',
};

describe('validação do evento novo', () => {
  it('aceita evento completo', () => {
    expect(validateEventDraft(event)).toEqual({});
    expect(validateEventDraft({ ...event, endsAt: '2026-11-29T21:00' })).toEqual({});
  });

  it('exige título e início; término depois do início', () => {
    expect(validateEventDraft({ ...event, title: '  ', startsAt: '' })).toEqual({
      title: 'Informe o título.',
      startsAt: 'Informe data e hora de início.',
    });
    expect(validateEventDraft({ ...event, endsAt: '2026-11-29T18:00' })).toEqual({
      endsAt: 'O término precisa ser depois do início.',
    });
  });
});

describe('linhas da escala', () => {
  const existing = [{ id: 'a1', userId: 'ana', functionId: 5 }];

  it('grava só linhas completas, sem repetir e sem o que já está na escala', () => {
    expect(
      assignmentsToInsert(
        'ev',
        [
          row('1', 'isa', 7, ' levar baquetas '),
          row('2', 'isa', 7), // repetida
          row('3', 'ana', 5), // já está na escala
          row('4', 'lucas', null), // incompleta
          row('5', '', null), // vazia
          row('6', 'ana', 2),
        ],
        existing,
      ),
    ).toEqual([
      { event_id: 'ev', user_id: 'isa', function_id: 7, notes: 'levar baquetas' },
      { event_id: 'ev', user_id: 'ana', function_id: 2, notes: null },
    ]);
  });

  it('aponta o problema de cada linha (a vazia é só ignorada)', () => {
    expect(
      draftProblems(
        [
          row('1', 'isa', 7),
          row('2', 'isa', 7),
          row('3', 'ana', 5),
          row('4', 'lucas', null),
          row('5', '', 3),
          row('6', '', null),
        ],
        existing,
      ),
    ).toEqual({
      '2': 'Essa pessoa já está nessa função.',
      '3': 'Essa pessoa já está nessa função.',
      '4': 'Escolha a função.',
      '5': 'Escolha a pessoa.',
    });
  });

  it('as funções da pessoa vêm primeiro', () => {
    const fns = [
      { id: 1, name: 'Vocal principal' },
      { id: 3, name: 'Violão' },
      { id: 7, name: 'Bateria' },
    ];
    expect(functionOptions(fns, { id: 'isa', name: 'Isa', functionIds: [7] })).toEqual({
      own: [{ id: 7, name: 'Bateria' }],
      others: [
        { id: 1, name: 'Vocal principal' },
        { id: 3, name: 'Violão' },
      ],
    });
    expect(functionOptions(fns, undefined).own).toEqual([]);
  });
});
