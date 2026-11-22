/**
 * Formato de gravação por navegador. Áudio de ensaio é voz e instrumentos em sala: bitrate
 * baixo já fica bom e cabe muito tempo no limite de 45 MB.
 * - Chrome/Android/Firefox: WebM com Opus a ~32 kbps (≈ 14 KB/s → ~3 h em 45 MB).
 * - Safari/iPhone (sem WebM no MediaRecorder): MP4/AAC com bitrate baixo (~48 kbps → ~2 h).
 */
export interface RecordingFormat {
  mimeType: string;
  extension: 'webm' | 'm4a' | 'ogg';
  /** Bits por segundo pedidos ao MediaRecorder (o navegador pode arredondar). */
  bitsPerSecond: number;
}

const CANDIDATES: RecordingFormat[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm', bitsPerSecond: 32_000 },
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', extension: 'm4a', bitsPerSecond: 48_000 },
  { mimeType: 'audio/mp4', extension: 'm4a', bitsPerSecond: 48_000 },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg', bitsPerSecond: 32_000 },
  { mimeType: 'audio/webm', extension: 'webm', bitsPerSecond: 32_000 },
];

/**
 * Primeiro formato que o navegador grava. `isTypeSupported` é MediaRecorder.isTypeSupported
 * (injetável para teste). `null` = o navegador não grava áudio.
 */
export function chooseRecordingFormat(
  isTypeSupported: (mimeType: string) => boolean,
): RecordingFormat | null {
  return CANDIDATES.find((c) => isTypeSupported(c.mimeType)) ?? null;
}

/** Tipo "puro" (sem codecs) para gravar no banco e no Storage: "audio/webm". */
export function baseMimeType(mimeType: string): string {
  return mimeType.split(';')[0]!.trim().toLowerCase();
}

/** Extensão para um arquivo enviado (pelo tipo ou pelo nome). */
export function extensionFor(mimeType: string, fileName = ''): string {
  const fromName = /\.([a-z0-9]{2,5})$/i.exec(fileName)?.[1]?.toLowerCase();
  const byType: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/aac': 'aac',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/wave': 'wav',
    'audio/flac': 'flac',
  };
  return byType[baseMimeType(mimeType)] ?? fromName ?? 'audio';
}

/**
 * Nome legível para baixar um áudio: "Ensaio 26-11 - Parte 1.webm",
 * "Ensaio 26-11 - Arranjo.m4a" ou "Grande é o Senhor - Voz guia.mp3". Sem caracteres que os
 * sistemas de arquivo recusam.
 */
export function audioDownloadName(input: {
  prefix: string;
  label: string | null;
  position: number;
  mimeType: string;
  /** Sem nome: "Parte N" (ensaio) ou "Áudio N" (referência). */
  fallback: 'Parte' | 'Áudio';
}): string {
  const name = input.label?.trim() || `${input.fallback} ${input.position}`;
  const safe = (text: string) =>
    text
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  const ext = extensionFor(input.mimeType);
  return `${safe(input.prefix)} - ${safe(name)}.${ext}`.slice(0, 120);
}
