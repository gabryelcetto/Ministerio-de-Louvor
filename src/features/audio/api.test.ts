import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/supabase', () => ({ supabase: {} }));

const { labelProblem, LABEL_SUGGESTIONS, mediaTitle, normalizeLabel, storageLevel } =
  await import('./api');
const { sessionTarget, sessionsFor } = await import('@/lib/audio/recording-store');
const { friendlyError } = await import('@/lib/errors');

describe('nome do áudio', () => {
  it('tira espaços sobrando e vazio vira "sem nome"', () => {
    expect(normalizeLabel('  Voz   guia ')).toBe('Voz guia');
    expect(normalizeLabel('   ')).toBeNull();
  });

  it('até 60 caracteres (mesma regra do banco)', () => {
    expect(labelProblem('a'.repeat(60))).toBeNull();
    expect(labelProblem('a'.repeat(61))).toBe('Use até 60 caracteres.');
    expect(labelProblem('')).toBeNull();
  });

  it('sugestões pedidas pelo ministério', () => {
    expect(LABEL_SUGGESTIONS).toEqual(['Voz guia', 'Arranjo', 'Ensaio']);
  });

  it('título na lista: o nome ou "Gravação N" / "Áudio N"', () => {
    expect(mediaTitle('reference', 'Arranjo', 2)).toBe('Arranjo');
    expect(mediaTitle('reference', null, 2)).toBe('Áudio 2');
    expect(mediaTitle('rehearsal', null, 1)).toBe('Gravação 1');
  });
});

describe('gravações guardadas no aparelho', () => {
  const base = {
    mimeType: 'audio/webm',
    extension: 'webm',
    durationMs: 1000,
    bytes: 10,
    status: 'stopped' as const,
  };

  it('sessões antigas (só eventId) continuam sendo do ensaio', () => {
    expect(sessionTarget({ ...base, id: 'a', startedAt: '1', eventId: 'ev' })).toEqual({
      kind: 'rehearsal',
      targetId: 'ev',
    });
  });

  it('separa ensaio e música e ordena da mais antiga para a mais nova', () => {
    const sessions = [
      {
        ...base,
        id: 'b',
        startedAt: '2026-11-21T10:00',
        kind: 'reference' as const,
        targetId: 'm',
      },
      {
        ...base,
        id: 'a',
        startedAt: '2026-11-21T09:00',
        kind: 'reference' as const,
        targetId: 'm',
      },
      { ...base, id: 'c', startedAt: '2026-11-21T08:00', eventId: 'm' },
      {
        ...base,
        id: 'd',
        startedAt: '2026-11-21T08:00',
        kind: 'reference' as const,
        targetId: 'x',
      },
    ];
    expect(sessionsFor(sessions, { kind: 'reference', targetId: 'm' }).map((s) => s.id)).toEqual([
      'a',
      'b',
    ]);
    expect(sessionsFor(sessions, { kind: 'rehearsal', targetId: 'm' }).map((s) => s.id)).toEqual([
      'c',
    ]);
  });
});

describe('limites do banco', () => {
  const GB = 1024 * 1024 * 1024;
  const usage = (totalBytes: number) => ({
    totalBytes,
    limitBytes: GB,
    blockBytes: Math.floor(GB * 0.9),
  });

  it('espaço: ok, perto do fim (70%) e bloqueado (90%)', () => {
    expect(storageLevel(usage(0.5 * GB))).toBe('ok');
    expect(storageLevel(usage(0.75 * GB))).toBe('warn');
    expect(storageLevel(usage(Math.floor(GB * 0.9)))).toBe('blocked');
  });

  it('mensagens do banco chegam em português para a pessoa', () => {
    expect(
      friendlyError({
        code: 'P0001',
        message: 'Esta música já tem 3 áudios de referência. Apague um para enviar outro.',
      }),
    ).toBe('Esta música já tem 3 áudios de referência. Apague um para enviar outro.');
    expect(
      friendlyError({
        code: 'P0001',
        message:
          'O espaço dos áudios passou de 90% de 1 GB. Novos envios estão bloqueados até um admin apagar áudios antigos.',
      }),
    ).toMatch(/^O espaço dos áudios passou de 90% de 1 GB/);
  });
});
