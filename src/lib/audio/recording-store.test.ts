import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  appendChunk,
  assembleRecording,
  deleteSession,
  listSessions,
  saveSession,
  sessionTarget,
  type RecordingSession,
} from './recording-store';

let n = 0;
function session(patch: Partial<RecordingSession> = {}): RecordingSession {
  n++;
  return {
    id: `s${n}-${Math.random()}`,
    kind: 'reference',
    targetId: 'musica-1',
    mimeType: 'audio/webm',
    extension: 'webm',
    startedAt: `2026-11-21T10:${String(n).padStart(2, '0')}:00Z`,
    durationMs: 0,
    bytes: 0,
    status: 'recording',
    ...patch,
  };
}

const text = (blob: Blob) => blob.text();

describe('gravações guardadas no aparelho (IndexedDB)', () => {
  it('guarda e lista só as sessões do alvo, da mais antiga para a mais nova', async () => {
    const a = session({ targetId: 'musica-a', startedAt: '2026-11-21T10:05:00Z' });
    const b = session({ targetId: 'musica-a', startedAt: '2026-11-21T10:01:00Z' });
    const outra = session({ targetId: 'musica-b' });
    const ensaio = session({ kind: 'rehearsal', targetId: 'musica-a' });
    for (const s of [a, b, outra, ensaio]) await saveSession(s);

    const list = await listSessions({ kind: 'reference', targetId: 'musica-a' });
    expect(list.map((s) => s.id)).toEqual([b.id, a.id]);
    expect(
      (await listSessions({ kind: 'rehearsal', targetId: 'musica-a' })).map((s) => s.id),
    ).toEqual([ensaio.id]);
  });

  it('sessão antiga (só eventId) aparece no ensaio', async () => {
    const antiga = session({ kind: undefined, targetId: undefined, eventId: 'ensaio-velho' });
    await saveSession(antiga);
    const list = await listSessions({ kind: 'rehearsal', targetId: 'ensaio-velho' });
    expect(list.map((s) => s.id)).toEqual([antiga.id]);
    expect(sessionTarget({ ...antiga, eventId: undefined })).toEqual({
      kind: 'rehearsal',
      targetId: '',
    });
  });

  it('junta os pedaços na ordem gravada e atualiza tamanho e duração', async () => {
    const s = session({ targetId: 'musica-pedacos' });
    await saveSession(s);
    // Pedaços chegam fora de ordem no banco local: a junção respeita o número de sequência.
    await appendChunk({ ...s, bytes: 2, durationMs: 5000 }, 1, new Blob(['B']));
    await appendChunk({ ...s, bytes: 1, durationMs: 2500 }, 0, new Blob(['A']));
    await appendChunk({ ...s, bytes: 3, durationMs: 7000 }, 2, new Blob(['C']));

    const blob = await assembleRecording(s);
    expect(await text(blob)).toBe('ABC');
    expect(blob.type).toBe('audio/webm');
    const [saved] = await listSessions({ kind: 'reference', targetId: 'musica-pedacos' });
    expect(saved).toMatchObject({ bytes: 3, durationMs: 7000 });
  });

  it('descartar apaga a sessão e os pedaços dela (e só dela)', async () => {
    const fica = session({ targetId: 'musica-descartar' });
    const sai = session({ targetId: 'musica-descartar' });
    await saveSession(fica);
    await saveSession(sai);
    await appendChunk(fica, 0, new Blob(['fica']));
    await appendChunk(sai, 0, new Blob(['sai']));
    await appendChunk(sai, 1, new Blob(['sai2']));

    await deleteSession(sai.id);

    const list = await listSessions({ kind: 'reference', targetId: 'musica-descartar' });
    expect(list.map((s) => s.id)).toEqual([fica.id]);
    expect(await text(await assembleRecording(sai))).toBe('');
    expect(await text(await assembleRecording(fica))).toBe('fica');
  });

  it('salvar de novo substitui a sessão (ex.: "gravando" → "parada")', async () => {
    const s = session({ targetId: 'musica-status' });
    await saveSession(s);
    await saveSession({ ...s, status: 'stopped', durationMs: 9000 });
    const [saved] = await listSessions({ kind: 'reference', targetId: 'musica-status' });
    expect(saved).toMatchObject({ status: 'stopped', durationMs: 9000 });
  });
});
