/**
 * Envio de arquivo ao Supabase Storage COM barra de progresso.
 * O supabase-js não informa progresso; aqui usamos a mesma rota REST do Storage com
 * XMLHttpRequest (que tem `upload.onprogress`). A autorização é o token da sessão do usuário:
 * quem decide se pode é a policy do bucket.
 */
export class UploadError extends Error {
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
}

/** Mensagem em português para a resposta do Storage. */
export function uploadErrorMessage(status: number, body: string): string {
  if (status === 0) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  if (status === 413 || /maximum allowed size|too large|exceeded the maximum/i.test(body)) {
    return 'O arquivo passou do limite de 45 MB.';
  }
  if (status === 415 || /mime type|not supported/i.test(body)) {
    return 'Tipo de arquivo não aceito: envie um arquivo de áudio.';
  }
  if (status === 401 || status === 403 || /row-level security|unauthorized/i.test(body)) {
    return 'Você não tem permissão para enviar este áudio.';
  }
  if (status === 409 || /already exists|duplicate/i.test(body)) {
    return 'Já existe um arquivo com este nome. Tente de novo.';
  }
  return 'Não foi possível enviar o áudio. Tente de novo.';
}

export function uploadWithProgress(options: UploadOptions): Promise<void> {
  const { supabaseUrl, apiKey, accessToken, bucket, path, file, contentType } = options;
  const url = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', apiKey);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=3600');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) options.onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(1);
        resolve();
      } else {
        reject(new UploadError(uploadErrorMessage(xhr.status, xhr.responseText), xhr.status));
      }
    };
    xhr.onerror = () => reject(new UploadError(uploadErrorMessage(0, ''), 0));
    xhr.onabort = () => reject(new UploadError('Envio cancelado.', 0));
    options.signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(file);
  });
}
