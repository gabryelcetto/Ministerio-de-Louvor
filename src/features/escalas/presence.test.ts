import { describe, expect, it } from 'vitest';
import {
  canRespond,
  combinedResponse,
  formatPeriod,
  isUnavailableOn,
  periodError,
  RESPONSE_LABEL,
  upcomingPeriods,
} from './presence';

describe('presença', () => {
  it('uma recusa pesa mais; confirmado só se todas as funções confirmaram', () => {
    expect(combinedResponse([])).toBe('pending');
    expect(combinedResponse(['confirmed'])).toBe('confirmed');
    expect(combinedResponse(['confirmed', 'pending'])).toBe('pending');
    expect(combinedResponse(['confirmed', 'declined'])).toBe('declined');
    expect(combinedResponse(['pending', 'declined'])).toBe('declined');
  });

  it('rótulos em linguagem simples', () => {
    expect(RESPONSE_LABEL).toEqual({
      pending: 'Aguardando resposta',
      confirmed: 'Confirmado',
      declined: 'Não pode',
    });
  });

  it('só responde antes de o evento começar', () => {
    const now = new Date('2026-11-22T12:00:00Z');
    expect(canRespond('2026-11-22T12:00:01Z', now)).toBe(true);
    expect(canRespond('2026-11-22T12:00:00Z', now)).toBe(false);
    expect(canRespond('2026-11-21T12:00:00Z', now)).toBe(false);
  });
});

describe('indisponibilidade', () => {
  const periods = [
    { starts_on: '2026-12-10', ends_on: '2026-12-12' },
    { starts_on: '2026-12-20', ends_on: '2026-12-20' },
  ];

  it('valida o período', () => {
    expect(periodError('', '')).toBe('Informe o primeiro e o último dia.');
    expect(periodError('2026-12-10', '')).toBe('Informe o primeiro e o último dia.');
    expect(periodError('2026-12-10', '2026-12-09')).toBe(
      'O último dia não pode ser antes do primeiro.',
    );
    expect(periodError('2026-12-10', '2026-12-10')).toBeNull();
  });

  it('confere o dia dentro dos períodos (limites inclusos)', () => {
    expect(isUnavailableOn(periods, '2026-12-10')).toBe(true);
    expect(isUnavailableOn(periods, '2026-12-12')).toBe(true);
    expect(isUnavailableOn(periods, '2026-12-13')).toBe(false);
    expect(isUnavailableOn(periods, '2026-12-20')).toBe(true);
    expect(isUnavailableOn([], '2026-12-20')).toBe(false);
  });

  it('formata o período (ano só se for outro)', () => {
    const now = new Date('2026-11-22T12:00:00Z');
    expect(formatPeriod(periods[0]!, now)).toBe('10/12 a 12/12');
    expect(formatPeriod(periods[1]!, now)).toBe('20/12');
    expect(formatPeriod({ starts_on: '2027-01-02', ends_on: '2027-01-02' }, now)).toBe(
      '02/01/2027',
    );
  });

  it('lista só os que não terminaram, do mais próximo', () => {
    const list = [periods[1]!, { starts_on: '2026-11-01', ends_on: '2026-11-03' }, periods[0]!];
    expect(upcomingPeriods(list, '2026-12-11')).toEqual([periods[0], periods[1]]);
    expect(upcomingPeriods(list, '2026-12-21')).toEqual([]);
  });
});
