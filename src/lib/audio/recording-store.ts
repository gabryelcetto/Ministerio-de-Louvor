/**
 * Pedaços da gravação guardados no IndexedDB DURANTE a gravação.
 * Se o app fechar, o celular desligar a tela ou a internet cair, nada se perde: ao voltar à
 * tela do ensaio, a gravação aparece como "não enviada" para enviar ou descartar.
 * IndexedDB puro (sem biblioteca); tudo no aparelho, nada vai para o servidor até o envio.
 */
const DB_NAME = 'louvor-gravacoes';
const DB_VERSION = 1;

export interface RecordingSession {
  id: string;
  eventId: string;
  mimeType: string;
  extension: string;
  startedAt: string;
  /** Duração gravada (atualizada a cada pedaço). */
  durationMs: number;
  bytes: number;
  /** recording = ainda gravando (ou o app fechou no meio); stopped = pronta para enviar. */
  status: 'recording' | 'stopped';
}

interface ChunkRow {
  sessionId: string;
  seq: number;
  blob: Blob;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sessions'))
        db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('chunks')) {
        const chunks = db.createObjectStore('chunks', { keyPath: ['sessionId', 'seq'] });
        chunks.createIndex('bySession', 'sessionId');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

export async function saveSession(session: RecordingSession): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('sessions', 'readwrite');
  tx.objectStore('sessions').put(session);
  await done(tx);
}

/** Guarda um pedaço e atualiza duração/tamanho da sessão na mesma transação. */
export async function appendChunk(
  session: RecordingSession,
  seq: number,
  blob: Blob,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['chunks', 'sessions'], 'readwrite');
  tx.objectStore('chunks').put({ sessionId: session.id, seq, blob } satisfies ChunkRow);
  tx.objectStore('sessions').put(session);
  await done(tx);
}

export async function listSessions(eventId: string): Promise<RecordingSession[]> {
  const db = await openDb();
  const all = await promisify<RecordingSession[]>(
    db.transaction('sessions').objectStore('sessions').getAll(),
  );
  return all
    .filter((s) => s.eventId === eventId)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** Junta os pedaços na ordem em que foram gravados. */
export async function assembleRecording(session: RecordingSession): Promise<Blob> {
  const db = await openDb();
  const rows = await promisify<ChunkRow[]>(
    db
      .transaction('chunks')
      .objectStore('chunks')
      .index('bySession')
      .getAll(IDBKeyRange.only(session.id)),
  );
  rows.sort((a, b) => a.seq - b.seq);
  return new Blob(
    rows.map((r) => r.blob),
    { type: session.mimeType },
  );
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['chunks', 'sessions'], 'readwrite');
  tx.objectStore('sessions').delete(sessionId);
  const index = tx.objectStore('chunks').index('bySession');
  const keys = await promisify(index.getAllKeys(IDBKeyRange.only(sessionId)));
  for (const key of keys) tx.objectStore('chunks').delete(key);
  await done(tx);
}
