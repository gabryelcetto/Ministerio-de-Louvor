/**
 * Compartilhar e baixar pelo navegador, com plano B:
 * - shareText: Web Share API (menu do celular); sem ela, copia o texto e abre o WhatsApp.
 * - shareFile: Web Share com arquivo quando o aparelho aceita.
 * - downloadBlob: baixa um arquivo gerado no aparelho (ex.: .ics).
 */
import { whatsappShareUrl } from './share';

export type ShareOutcome = 'shared' | 'cancelled' | 'copied-whatsapp' | 'copied' | 'failed';

interface ShareEnv {
  navigator?: Partial<Pick<Navigator, 'share' | 'canShare' | 'clipboard'>>;
  open?: (url: string, target?: string, features?: string) => unknown;
}

function env(): ShareEnv {
  return {
    navigator: typeof navigator === 'undefined' ? undefined : navigator,
    open: typeof window === 'undefined' ? undefined : window.open.bind(window),
  };
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function copy(text: string, e: ShareEnv): Promise<boolean> {
  try {
    if (!e.navigator?.clipboard) return false;
    await e.navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function shareText(
  data: { title: string; text: string },
  e: ShareEnv = env(),
): Promise<ShareOutcome> {
  if (e.navigator?.share) {
    try {
      await e.navigator.share({ title: data.title, text: data.text });
      return 'shared';
    } catch (error) {
      if (isAbort(error)) return 'cancelled';
      // Falhou por outro motivo: segue para o plano B.
    }
  }
  const copied = await copy(data.text, e);
  if (e.open) {
    e.open(whatsappShareUrl(data.text), '_blank', 'noopener,noreferrer');
    return copied ? 'copied-whatsapp' : 'failed';
  }
  return copied ? 'copied' : 'failed';
}

/** Compartilha um arquivo; sem suporte, devolve null para a tela usar o plano B (link). */
export async function shareFile(
  file: File,
  title: string,
  e: ShareEnv = env(),
): Promise<ShareOutcome | null> {
  const nav = e.navigator;
  if (!nav?.share || !nav.canShare?.({ files: [file] })) return null;
  try {
    await nav.share({ files: [file], title });
    return 'shared';
  } catch (error) {
    return isAbort(error) ? 'cancelled' : null;
  }
}

export async function copyText(text: string, e: ShareEnv = env()): Promise<boolean> {
  return copy(text, e);
}

export function downloadBlob(blob: Blob, fileName: string, doc: Document = document): void {
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  doc.body.appendChild(a);
  a.click();
  a.remove();
  // Dá tempo ao navegador de começar o download antes de liberar a URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
