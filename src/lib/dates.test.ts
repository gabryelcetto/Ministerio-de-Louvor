import { describe, expect, it } from 'vitest';
import {
  addMonths,
  dateBlock,
  dayKey,
  formatDayLabel,
  formatMonthLabel,
  formatShortDate,
  formatTime,
  formatTimeRange,
  greeting,
  groupByDay,
  isMonthKey,
  isoToZonedLocal,
  monthKey,
  monthRange,
  weeklyOccurrences,
  zonedLocalToIso,
} from './dates';

// Horários em UTC; São Paulo é UTC-3 (sem horário de verão desde 2019).
describe('datas no fuso da igreja', () => {
  it('usa o dia de São Paulo, não o de UTC', () => {
    // 01:30 UTC do dia 24 = 22:30 do dia 23 em São Paulo.
    expect(dayKey('2026-11-24T01:30:00Z')).toBe('2026-11-23');
    expect(formatTime('2026-11-24T01:30:00Z')).toBe('22:30');
  });

  it('formata intervalo de horário', () => {
    expect(formatTimeRange('2026-11-23T22:00:00Z', '2026-11-24T00:00:00Z')).toBe('19:00–21:00');
    expect(formatTimeRange('2026-11-23T22:00:00Z', null)).toBe('19:00');
  });

  it('rotula hoje, amanhã e outros dias', () => {
    const now = new Date('2026-11-19T15:00:00Z'); // quinta, 12:00 em SP
    expect(formatDayLabel('2026-11-19T23:00:00Z', now)).toBe('Hoje');
    expect(formatDayLabel('2026-11-20T22:30:00Z', now)).toBe('Amanhã');
    expect(formatDayLabel('2026-11-22T13:00:00Z', now)).toBe('Domingo, 22 de novembro');
  });

  it('saúda pela hora local', () => {
    expect(greeting(new Date('2026-11-19T11:00:00Z'))).toBe('Bom dia'); // 08h
    expect(greeting(new Date('2026-11-19T17:00:00Z'))).toBe('Boa tarde'); // 14h
    expect(greeting(new Date('2026-11-19T23:00:00Z'))).toBe('Boa noite'); // 20h
    expect(greeting(new Date('2026-11-19T06:00:00Z'))).toBe('Boa noite'); // 03h
  });

  it('agrupa por dia mantendo a ordem', () => {
    const items = [
      { id: 'a', at: '2026-11-22T13:00:00Z' },
      { id: 'b', at: '2026-11-22T22:00:00Z' },
      { id: 'c', at: '2026-11-23T01:00:00Z' }, // ainda dia 22 em SP
      { id: 'd', at: '2026-11-24T22:00:00Z' },
    ];
    const groups = groupByDay(items, (i) => i.at);
    expect(groups.map((g) => [g.day, g.items.map((i) => i.id)])).toEqual([
      ['2026-11-22', ['a', 'b', 'c']],
      ['2026-11-24', ['d']],
    ]);
  });
});

describe('datetime-local no fuso da igreja', () => {
  it('lê o horário digitado como de São Paulo (UTC-3)', () => {
    expect(zonedLocalToIso('2026-11-23T19:30')).toBe('2026-11-23T22:30:00.000Z');
    expect(zonedLocalToIso('2026-11-23T22:30')).toBe('2026-11-24T01:30:00.000Z');
    expect(zonedLocalToIso('23/11/2026 19:30')).toBeNull();
  });

  it('faz o caminho de volta para preencher o campo', () => {
    expect(isoToZonedLocal('2026-11-24T01:30:00Z')).toBe('2026-11-23T22:30');
    expect(isoToZonedLocal(zonedLocalToIso('2027-01-02T09:05') as string)).toBe('2027-01-02T09:05');
  });
});

describe('bloco de data dos cards de evento', () => {
  it('dia da semana abreviado (sem ponto, maiúsculo) e o dia, no fuso da igreja', () => {
    // 22/11/2026 é domingo; 02:00 UTC ainda é sábado, 21, em São Paulo.
    expect(dateBlock('2026-11-22T22:00:00Z')).toEqual({ weekday: 'DOM', day: '22' });
    expect(dateBlock('2026-11-22T02:00:00Z')).toEqual({ weekday: 'SÁB', day: '21' });
    expect(dateBlock(new Date('2026-11-25T15:00:00Z'))).toEqual({ weekday: 'QUA', day: '25' });
  });
});

describe('repetir toda semana', () => {
  it('mesmo horário de Brasília, virando o mês e o ano', () => {
    expect(weeklyOccurrences('2026-12-24T19:30', 3)).toEqual([
      '2026-12-24T22:30:00.000Z',
      '2026-12-31T22:30:00.000Z',
      '2027-01-07T22:30:00.000Z',
    ]);
    expect(weeklyOccurrences('2026-11-26T20:00', 2).map((d) => formatShortDate(d))).toEqual([
      formatShortDate('2026-11-26T23:00:00Z'),
      formatShortDate('2026-12-03T23:00:00Z'),
    ]);
  });

  it('entrada inválida ou zero semanas: nada', () => {
    expect(weeklyOccurrences('', 3)).toEqual([]);
    expect(weeklyOccurrences('2026-12-24T19:30', 0)).toEqual([]);
    expect(weeklyOccurrences('2026-12-24T19:30', 1)).toEqual(['2026-12-24T22:30:00.000Z']);
  });
});

describe('meses da agenda', () => {
  it('mês no fuso de São Paulo, validação e soma virando o ano', () => {
    expect(monthKey('2026-12-01T02:00:00Z')).toBe('2026-11');
    expect(isMonthKey('2026-11')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-00')).toBe(false);
    expect(isMonthKey(null)).toBe(false);
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-11', -13)).toBe('2025-10');
  });

  it('intervalo do mês e nome', () => {
    expect(monthRange('2026-11')).toEqual({
      from: '2026-11-01T03:00:00.000Z',
      to: '2026-12-01T03:00:00.000Z',
    });
    expect(formatMonthLabel('2026-11')).toBe('novembro de 2026');
    expect(formatMonthLabel('2027-01')).toBe('janeiro de 2027');
  });
});
