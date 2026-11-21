/**
 * Limites de áudio (plano grátis do Supabase: 50 MB por arquivo e 1 GB no total).
 * O bucket "audios" aceita até 45 MB (margem), o mesmo valor da migration.
 */
export const MAX_AUDIO_BYTES = 45 * 1024 * 1024;
/** A partir daqui a gravação avisa que está chegando ao limite. */
export const WARN_AUDIO_BYTES = 40 * 1024 * 1024;
/** A gravação para sozinha aqui (sobra folga para o fim do último pedaço). */
export const STOP_AUDIO_BYTES = 44 * 1024 * 1024;
export const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1024)
    return `${mb.toLocaleString('pt-BR', { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
  return `${(mb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GB`;
}

/** "1:05", "12:30", "1:02:03". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Minutos que cabem no limite com um bitrate (para mostrar "cabe ~3 h"). */
export function minutesThatFit(bitsPerSecond: number, bytes = MAX_AUDIO_BYTES): number {
  return Math.floor((bytes * 8) / bitsPerSecond / 60);
}

/** Problema de um arquivo de áudio escolhido para envio (null = pode enviar). */
export function audioFileProblem(file: {
  size: number;
  type: string;
  name: string;
}): string | null {
  const isAudio =
    file.type.startsWith('audio/') ||
    (!file.type && /\.(mp3|m4a|aac|wav|ogg|opus|webm|flac)$/i.test(file.name));
  if (!isAudio) return 'Escolha um arquivo de áudio (mp3, m4a, wav, ogg…).';
  if (file.size === 0) return 'O arquivo está vazio.';
  if (file.size > MAX_AUDIO_BYTES) {
    return `O arquivo tem ${formatBytes(file.size)}; o limite é ${formatBytes(MAX_AUDIO_BYTES)}. Diminua a qualidade ou corte o áudio.`;
  }
  return null;
}

export type RecordingSizeLevel = 'ok' | 'warn' | 'stop';

/** Situação da gravação pelo tamanho acumulado. */
export function recordingSizeLevel(bytes: number): RecordingSizeLevel {
  if (bytes >= STOP_AUDIO_BYTES) return 'stop';
  if (bytes >= WARN_AUDIO_BYTES) return 'warn';
  return 'ok';
}
