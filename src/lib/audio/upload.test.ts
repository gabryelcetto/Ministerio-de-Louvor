import { afterEach, describe, expect, it, vi } from 'vitest';
import { friendlyError, UserFacingError } from '../errors';
import { UploadError, uploadErrorMessage, uploadWithProgress } from './upload';

/** XMLHttpRequest de mentira: guarda o que o código fez e deixa o teste decidir a resposta. */
class FakeXhr {
  static last: FakeXhr;
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown;
  status = 0;
  responseText = '';
  aborted = false;
  upload: {
    onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null;
  } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  respond(status: number, text = '') {
    this.status = status;
    this.responseText = text;
    this.onload?.();
  }
}

vi.stubGlobal('XMLHttpRequest', FakeXhr);
afterEach(() => vi.clearAllMocks());

const file = new Blob(['abc'], { type: 'audio/webm' });
const base = {
  supabaseUrl: 'https://projeto.supabase.co/',
  apiKey: 'chave-publica',
  accessToken: 'token-da-sessao',
  bucket: 'audios',
  path: 'reference/musica 1/arquivo#1.webm',
  file,
  contentType: 'audio/webm',
};

describe('envio com progresso (Storage REST)', () => {
  it('monta a URL com cada parte do caminho codificada e os cabeçalhos da sessão', async () => {
    const done = uploadWithProgress(base);
    const xhr = FakeXhr.last;
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe(
      'https://projeto.supabase.co/storage/v1/object/audios/reference/musica%201/arquivo%231.webm',
    );
    expect(xhr.headers).toEqual({
      Authorization: 'Bearer token-da-sessao',
      apikey: 'chave-publica',
      'Content-Type': 'audio/webm',
      'x-upsert': 'false',
      'cache-control': 'max-age=3600',
    });
    expect(xhr.body).toBe(file);
    xhr.respond(200);
    await expect(done).resolves.toBeUndefined();
  });

  it('informa o progresso e termina em 100%', async () => {
    const onProgress = vi.fn();
    const done = uploadWithProgress({ ...base, onProgress });
    const xhr = FakeXhr.last;
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 });
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 2, total: 0 });
    xhr.respond(201);
    await done;
    expect(onProgress.mock.calls).toEqual([[0.25], [1]]);
  });

  it('sem onProgress também funciona', async () => {
    const done = uploadWithProgress(base);
    FakeXhr.last.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 });
    FakeXhr.last.respond(299);
    await expect(done).resolves.toBeUndefined();
  });

  it('erro HTTP vira UploadError com mensagem em português e o status', async () => {
    const done = uploadWithProgress(base);
    FakeXhr.last.respond(413, 'Payload too large');
    const error = await done.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UploadError);
    expect(error).toMatchObject({
      name: 'UploadError',
      status: 413,
      message: 'O arquivo passou do limite de 45 MB.',
    });
  });

  it('status 300 não é sucesso', async () => {
    const done = uploadWithProgress(base);
    FakeXhr.last.respond(300);
    await expect(done).rejects.toMatchObject({ status: 300 });
  });

  it('queda de rede e cancelamento', async () => {
    const offline = uploadWithProgress(base);
    FakeXhr.last.onerror?.();
    await expect(offline).rejects.toMatchObject({
      status: 0,
      message: 'Sem conexão. Tente de novo.',
    });

    const controller = new AbortController();
    const cancelled = uploadWithProgress({ ...base, signal: controller.signal });
    const xhr = FakeXhr.last;
    controller.abort();
    expect(xhr.aborted).toBe(true);
    await expect(cancelled).rejects.toMatchObject({ message: 'Envio cancelado.', status: 0 });
  });

  it('sem internet: falha na hora, sem abrir conexão (pendência 46)', async () => {
    const before = FakeXhr.last;
    const done = uploadWithProgress({ ...base, isOffline: () => true });
    await expect(done).rejects.toMatchObject({ status: 0, message: 'Sem conexão. Tente de novo.' });
    expect(FakeXhr.last).toBe(before);
  });

  it('envio parado (sem progresso) desiste com "Sem conexão"; o progresso reinicia a espera', async () => {
    vi.useFakeTimers();
    try {
      const done = uploadWithProgress({ ...base, stallTimeoutMs: 1000, isOffline: () => false });
      const xhr = FakeXhr.last;
      vi.advanceTimersByTime(900);
      xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 });
      vi.advanceTimersByTime(900);
      expect(xhr.aborted).toBe(false);
      vi.advanceTimersByTime(200);
      expect(xhr.aborted).toBe(true);
      await expect(done).rejects.toMatchObject({
        status: 0,
        message: 'Sem conexão. Tente de novo.',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('resposta antes do tempo limite: o temporizador é desarmado', async () => {
    vi.useFakeTimers();
    try {
      const done = uploadWithProgress({ ...base, stallTimeoutMs: 1000, isOffline: () => false });
      const xhr = FakeXhr.last;
      xhr.respond(200);
      vi.advanceTimersByTime(5000);
      expect(xhr.aborted).toBe(false);
      await expect(done).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a mensagem do envio chega à tela pelo friendlyError (pendência 47)', async () => {
    const done = uploadWithProgress(base);
    FakeXhr.last.respond(413);
    const error = await done.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UserFacingError);
    expect(friendlyError(error, 'genérica')).toBe('O arquivo passou do limite de 45 MB.');
  });
});

describe('uploadErrorMessage', () => {
  it.each([
    [0, '', 'Sem conexão. Tente de novo.'],
    [400, 'The object exceeded the maximum allowed size', 'O arquivo passou do limite de 45 MB.'],
    [400, 'File too large', 'O arquivo passou do limite de 45 MB.'],
    [413, '', 'O arquivo passou do limite de 45 MB.'],
    [415, '', 'Tipo de arquivo não aceito: envie um arquivo de áudio.'],
    [
      400,
      'mime type text/plain is not supported',
      'Tipo de arquivo não aceito: envie um arquivo de áudio.',
    ],
    [400, 'format not supported', 'Tipo de arquivo não aceito: envie um arquivo de áudio.'],
    [401, '', 'Você não tem permissão para isso. Fale com um administrador.'],
    [403, '', 'Você não tem permissão para isso. Fale com um administrador.'],
    [
      400,
      'new row violates row-level security policy',
      'Você não tem permissão para isso. Fale com um administrador.',
    ],
    [400, 'Unauthorized', 'Você não tem permissão para isso. Fale com um administrador.'],
    [409, '', 'Já existe um arquivo com este nome. Tente de novo.'],
    [400, 'The resource already exists', 'Já existe um arquivo com este nome. Tente de novo.'],
    [400, 'duplicate key', 'Já existe um arquivo com este nome. Tente de novo.'],
    [500, 'boom', 'Não foi possível enviar o áudio. Tente de novo.'],
  ])('status %i, corpo "%s"', (status, body, message) => {
    expect(uploadErrorMessage(status, body)).toBe(message);
  });
});
