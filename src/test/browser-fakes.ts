/**
 * Partes do navegador que o happy-dom não tem (ou não executa): gravador, microfone, Wake Lock,
 * XMLHttpRequest do envio e leitura da duração do áudio. Só para testes.
 */
import { vi } from 'vitest';

export class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported = (type: string) => type.startsWith('audio/webm');
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType: string;
  ondataavailable: ((e: { data: Blob | { size: number } }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_stream: unknown, options: { mimeType: string }) {
    this.mimeType = options.mimeType;
    FakeMediaRecorder.instances.push(this);
  }
  start() {
    this.state = 'recording';
  }
  pause() {
    this.state = 'paused';
  }
  resume() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['fim']) });
    this.onstop?.();
  }
  /** Simula um pedaço de N bytes chegando do gravador. */
  emit(size: number) {
    this.ondataavailable?.({ data: new Blob([new Uint8Array(Math.min(size, 16))]) as Blob });
    // O tamanho real do pedaço (o hook soma `size`): objeto com o tamanho pedido.
    if (size > 16) this.ondataavailable?.({ data: { size: size - 16 } as unknown as Blob });
  }
}

export class FakeUploadXhr {
  static status = 200;
  static body = '';
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
  status = 0;
  responseText = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open() {}
  setRequestHeader() {}
  abort() {}
  send() {
    setTimeout(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 } as ProgressEvent);
      this.status = FakeUploadXhr.status;
      this.responseText = FakeUploadXhr.body;
      this.onload?.();
    }, 0);
  }
}

export interface BrowserFakes {
  tracks: { stop: ReturnType<typeof vi.fn> }[];
  getUserMedia: ReturnType<typeof vi.fn>;
}

/** Liga gravador, microfone, Wake Lock e envio de mentira. Chamar no beforeEach. */
export function installBrowserFakes(): BrowserFakes {
  FakeMediaRecorder.instances = [];
  FakeUploadXhr.status = 200;
  FakeUploadXhr.body = '';
  const tracks = [{ stop: vi.fn() }];
  const getUserMedia = vi.fn(async () => ({ getTracks: () => tracks }));
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  vi.stubGlobal('XMLHttpRequest', FakeUploadXhr);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request: vi.fn(async () => ({ release: vi.fn(async () => undefined) })) },
  });
  // A leitura da duração do arquivo escolhido espera "loadedmetadata": dispara na hora.
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true,
    set(this: HTMLMediaElement) {
      queueMicrotask(() => this.onloadedmetadata?.(new Event('loadedmetadata')));
    },
    get() {
      return '';
    },
  });
  return { tracks, getUserMedia };
}
