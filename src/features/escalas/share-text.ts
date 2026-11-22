/**
 * Texto do evento para compartilhar (WhatsApp e afins): evento, data, hora, local, equipe por
 * grupo, repertório com o tom do dia e o link do app. Texto simples, com *negrito* do WhatsApp
 * só nos títulos.
 */
import { formatLongDate, formatTimeRange } from '@/lib/dates';
import { buildIcs, type IcsEvent } from '@/lib/ics';
import type { EventDetail } from './api';

export function eventShareText(detail: EventDetail, appUrl: string): string {
  const { event, teamBySection, songs } = detail;
  const lines: string[] = [`*${event.title}*`];
  if (event.status === 'cancelled') lines.push('(evento cancelado)');
  lines.push(
    `${capitalize(formatLongDate(event.starts_at))}, ${formatTimeRange(event.starts_at, event.ends_at)}`,
  );
  if (event.location) lines.push(`Local: ${event.location}`);

  for (const group of teamBySection) {
    if (group.members.length === 0) continue;
    lines.push('', `*${group.label}*`);
    for (const m of group.members) {
      lines.push(`- ${m.name}${m.functions.length ? ` (${m.functions.join(', ')})` : ''}`);
    }
  }

  if (songs.length > 0) {
    lines.push('', '*Repertório*');
    songs.forEach((s, i) => lines.push(`${i + 1}. ${s.title}${s.key ? ` (tom ${s.key})` : ''}`));
  }

  lines.push('', `Abrir no app: ${appUrl.replace(/\/$/, '')}/escalas/${event.id}`);
  return lines.join('\n');
}

/** Evento → .ics (com equipe e repertório na descrição). */
export function eventIcs(detail: EventDetail, appUrl: string, stamp?: Date): string {
  const { event } = detail;
  const description = eventShareText(detail, appUrl)
    .split('\n')
    .slice(1) // o título já é o SUMMARY
    .join('\n')
    .replace(/\*/g, '');
  const input: IcsEvent = {
    uid: `${event.id}@louvor-advop`,
    title: event.title,
    start: event.starts_at,
    end: event.ends_at,
    location: event.location,
    description,
    url: `${appUrl.replace(/\/$/, '')}/escalas/${event.id}`,
    stamp,
  };
  return buildIcs(input);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
