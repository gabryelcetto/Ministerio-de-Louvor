/**
 * "Publicar agora" ou "Agendar" (Fase H, item 17). O banco guarda o agendado com published_at
 * no futuro; o job publicar-comunicados (a cada 5 minutos) publica e avisa as pessoas.
 */
import { formatShortDate, formatTime, zonedLocalToIso } from '@/lib/dates';

export type PublishMode = 'now' | 'schedule';

/** Antecedência mínima do agendamento (o job roda a cada 5 minutos). */
export const MIN_LEAD_MINUTES = 5;

export interface PublishChoice {
  /** ISO para p_publish_at, ou `null` = publicar agora. */
  publishAt: string | null;
  problem: string | null;
}

/** Valida a data escolhida (valor de <input type="datetime-local">, horário de Brasília). */
export function publishChoice(
  mode: PublishMode,
  local: string,
  now: Date = new Date(),
): PublishChoice {
  if (mode === 'now') return { publishAt: null, problem: null };
  const iso = zonedLocalToIso(local);
  if (!iso) return { publishAt: null, problem: 'Escolha a data e a hora da publicação.' };
  if (Date.parse(iso) < now.getTime() + MIN_LEAD_MINUTES * 60_000) {
    return {
      publishAt: null,
      problem: `Escolha um horário daqui a pelo menos ${MIN_LEAD_MINUTES} minutos.`,
    };
  }
  return { publishAt: iso, problem: null };
}

/** "Agendado para 25/11 às 08:00" */
export function scheduledLabel(iso: string): string {
  return `Agendado para ${formatShortDate(iso)} às ${formatTime(iso)}`;
}

/** Texto do botão de enviar o formulário. */
export function submitLabel(mode: PublishMode, editing: 'new' | 'scheduled' | 'published'): string {
  if (mode === 'schedule') return editing === 'scheduled' ? 'Salvar agendamento' : 'Agendar';
  if (editing === 'published') return 'Salvar alterações';
  return editing === 'scheduled' ? 'Publicar agora' : 'Publicar';
}
