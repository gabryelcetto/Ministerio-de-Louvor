/**
 * Arquivo de calendário (.ics, RFC 5545) gerado no navegador — sem servidor.
 * Horário no fuso America/Sao_Paulo (com VTIMEZONE), texto escapado e linhas dobradas em 75
 * bytes, como a norma pede. O celular abre o arquivo e oferece "Adicionar à agenda".
 */
import { APP_TIME_ZONE } from './dates';

export interface IcsEvent {
  uid: string;
  title: string;
  start: string | Date;
  /** Sem término: 2 horas depois do início. */
  end?: string | Date | null;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  /** Data de geração (DTSTAMP); padrão: agora. */
  stamp?: Date;
}

const TWO_HOURS = 2 * 60 * 60 * 1000;

/** Escapa texto para propriedades do iCalendar: \ ; , e quebra de linha. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Dobra a linha em pedaços de até 75 bytes (UTF-8), continuando com um espaço. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // a continuação já começa com 1 espaço
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** "20261122T193000" no horário de Brasília. */
export function icsLocalDateTime(value: string | Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}${get('second')}`;
}

/** "20261122T223000Z" (UTC), para o DTSTAMP. */
export function icsUtcDateTime(value: Date): string {
  return value
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function buildIcs(event: IcsEvent): string {
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : new Date(start.getTime() + TWO_HOURS);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Louvor ADVOP//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    `TZID:${APP_TIME_ZONE}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0300',
    'TZOFFSETTO:-0300',
    'TZNAME:-03',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${icsUtcDateTime(event.stamp ?? new Date())}`,
    `DTSTART;TZID=${APP_TIME_ZONE}:${icsLocalDateTime(start)}`,
    `DTEND;TZID=${APP_TIME_ZONE}:${icsLocalDateTime(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

/** Nome de arquivo seguro: "culto-de-domingo-2026-11-22.ics". */
export function icsFileName(title: string, start: string | Date): string {
  const slug = title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const day = icsLocalDateTime(start).slice(0, 8);
  return `${slug || 'evento'}-${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}.ics`;
}
