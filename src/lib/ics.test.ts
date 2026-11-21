import { describe, expect, it } from 'vitest';
import {
  buildIcs,
  escapeIcsText,
  foldIcsLine,
  icsFileName,
  icsLocalDateTime,
  icsUtcDateTime,
} from './ics';

describe('arquivo de calendário (.ics)', () => {
  it('escapa barra, ponto e vírgula, vírgula e quebras de linha', () => {
    expect(escapeIcsText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf');
  });

  it('horário de Brasília e UTC', () => {
    expect(icsLocalDateTime('2026-11-22T22:30:00Z')).toBe('20261122T193000');
    // Meia-noite UTC ainda é o dia anterior em Brasília.
    expect(icsLocalDateTime('2026-12-01T01:00:00Z')).toBe('20261130T220000');
    expect(icsUtcDateTime(new Date('2026-11-22T22:30:05.123Z'))).toBe('20261122T223005Z');
  });

  it('dobra linhas longas em 75 bytes (acentos contam 2)', () => {
    const line = `SUMMARY:${'é'.repeat(60)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
    expect(foldIcsLine('curta')).toBe('curta');
  });

  it('monta o evento com fuso, término padrão de 2 horas e campos opcionais', () => {
    const ics = buildIcs({
      uid: 'ev1@louvor',
      title: 'Culto, domingo; especial',
      start: '2026-11-22T22:00:00Z',
      location: 'Templo, salão 1',
      description: 'Equipe:\nIsa',
      url: 'https://app.exemplo/escalas/ev1',
      stamp: new Date('2026-11-20T10:00:00Z'),
    });
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(lines).toContain('TZID:America/Sao_Paulo');
    expect(lines).toContain('DTSTART;TZID=America/Sao_Paulo:20261122T190000');
    expect(lines).toContain('DTEND;TZID=America/Sao_Paulo:20261122T210000');
    expect(lines).toContain('DTSTAMP:20261120T100000Z');
    expect(lines).toContain('SUMMARY:Culto\\, domingo\\; especial');
    expect(lines).toContain('LOCATION:Templo\\, salão 1');
    expect(lines).toContain('DESCRIPTION:Equipe:\\nIsa');
    expect(lines).toContain('URL:https://app.exemplo/escalas/ev1');
  });

  it('sem local nem descrição: as linhas não aparecem; término informado é respeitado', () => {
    const ics = buildIcs({
      uid: 'x',
      title: 'Ensaio',
      start: '2026-11-22T22:00:00Z',
      end: '2026-11-23T00:30:00Z',
    });
    expect(ics).not.toMatch(/LOCATION|DESCRIPTION|URL:/);
    expect(ics).toContain('DTEND;TZID=America/Sao_Paulo:20261122T213000');
  });

  it('nome do arquivo', () => {
    expect(icsFileName('Culto de Celebração!', '2026-11-22T22:00:00Z')).toBe(
      'culto-de-celebracao-2026-11-22.ics',
    );
    expect(icsFileName('***', '2026-11-22T22:00:00Z')).toBe('evento-2026-11-22.ics');
  });
});
