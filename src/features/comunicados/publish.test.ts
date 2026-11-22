import { describe, expect, it } from 'vitest';
import { publishChoice, scheduledLabel, submitLabel } from './publish';

describe('publicar agora ou agendar', () => {
  const now = new Date('2026-11-22T12:00:00Z'); // 09:00 em Brasília

  it('agora: sem data', () => {
    expect(publishChoice('now', '', now)).toEqual({ publishAt: null, problem: null });
  });

  it('agendar: exige data e pelo menos 5 minutos de antecedência', () => {
    expect(publishChoice('schedule', '', now).problem).toBe(
      'Escolha a data e a hora da publicação.',
    );
    expect(publishChoice('schedule', '2026-11-22T09:04', now).problem).toBe(
      'Escolha um horário daqui a pelo menos 5 minutos.',
    );
    expect(publishChoice('schedule', '2026-11-22T09:05', now)).toEqual({
      publishAt: '2026-11-22T12:05:00.000Z',
      problem: null,
    });
  });

  it('rótulos', () => {
    expect(scheduledLabel('2026-11-25T11:00:00Z')).toBe('Agendado para qua., 25/11 às 08:00');
    expect(submitLabel('now', 'new')).toBe('Publicar');
    expect(submitLabel('schedule', 'new')).toBe('Agendar');
    expect(submitLabel('schedule', 'scheduled')).toBe('Salvar agendamento');
    expect(submitLabel('now', 'scheduled')).toBe('Publicar agora');
    expect(submitLabel('now', 'published')).toBe('Salvar alterações');
  });
});
