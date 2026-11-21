/**
 * Envio de arquivo ao Supabase Storage COM barra de progresso.
 * O supabase-js não informa progresso; aqui usamos a mesma rota REST do Storage com
 * XMLHttpRequest (que tem `upload.onprogress`). A autorização é o token da sessão do usuário:
 * quem decide se pode é a policy do bucket.
 */
import { UserFacingError } from '../errors';
import { MESSAGES } from '../messages';
import { isKnownOffline, UPLOAD_STALL_TIMEOUT_MS } from '../network';

/** Erro do envio com a mensagem pronta para a tela (o friendlyError mostra como está). */
export class UploadError extends UserFacingError {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export interface UploadOptions {
  supabaseUrl: string;
  apiKey: string;
  accessToken: string;
  bucket: string;
  path: string;
  file: Blob;
  contentType: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  /** Desiste quando o envio fica sem progresso por este tempo (padrão: 30 s). */
  stallTimeoutMs?: number;
  /** Para testes: o navegador sabe que está sem internet? */
  isOffline?: () => boolean;
}

/** Mensagem em português para a resposta do Storage. */
export function uploadErrorMessage(status: number, body: string): string {
  if (status === 0) return MESSAGES.offline;
  if (status === 413 || /maximum allowed size|too large|exceeded the maximum/i.test(body)) {
    return MESSAGES.uploadTooLarge;
  }
  if (status === 415 || /mime type|not supported/i.test(body)) {
    return MESSAGES.uploadWrongType;
  }
  if (status === 401 || status === 403 || /row-level security|unauthorized/i.test(body)) {
    return MESSAGES.noPermission;
  }
  if (status === 409 || /already exists|duplicate/i.test(body)) {
    return MESSAGES.uploadDuplicate;
  }
  return MESSAGES.uploadFailed;
}

export function uploadWithProgress(options: UploadOptions): Promise<void> {
  const { supabaseUrl, apiKey, accessToken, bucket, path, file, contentType } = options;
  const url = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

  return new Promise((resolve, reject) => {
    // Sem internet: avisa na hora (a gravação continua no aparelho para tentar de novo).
    if ((options.isOffline ?? isKnownOffline)()) {
      reject(new UploadError(MESSAGES.offline, 0));
      return;
    }
    const xhr = new XMLHttpRequest();
    // Envio parado (rede caiu no meio): desiste depois de um tempo sem progresso.
    let stalled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const armStallTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        stalled = true;
        xhr.abort();
      }, options.stallTimeoutMs ?? UPLOAD_STALL_TIMEOUT_MS);
    };
    const fail = (error: UploadError) => {
      clearTimeout(timer);
      reject(error);
    };
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', apiKey);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=3600');
    xhr.upload.onprogress = (e) => {
      armStallTimer();
      if (e.lengthComputable) options.onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      clearTimeout(timer);
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(1);
        resolve();
      } else {
        reject(new UploadError(uploadErrorMessage(xhr.status, xhr.responseText), xhr.status));
      }
    };
    xhr.onerror = () => fail(new UploadError(uploadErrorMessage(0, ''), 0));
    xhr.onabort = () =>
      fail(new UploadError(stalled ? MESSAGES.offline : MESSAGES.uploadCanceled, 0));
    options.signal?.addEventListener('abort', () => xhr.abort());
    armStallTimer();
    xhr.send(file);
  });
}
