/**
 * Presença na escala (Fase H): "Confirmo" / "Não posso" e indisponibilidade.
 * As regras que protegem os dados estão no banco (trigger guard_assignment_update, RLS de
 * member_unavailability, assignment_substitutes); aqui ficam só as da interface.
 */
import type { AssignmentResponse } from '@/types/app.types';

export const RESPONSE_LABEL: Record<AssignmentResponse, string> = {
  pending: 'Aguardando resposta',
  confirmed: 'Confirmado',
  declined: 'Não pode',
};

/** Quando a pessoa tem mais de uma função no evento: uma recusa pesa mais que as confirmações. */
export function combinedResponse(responses: readonly AssignmentResponse[]): AssignmentResponse {
  if (responses.includes('declined')) return 'declined';
  if (responses.length > 0 && responses.every((r) => r === 'confirmed')) return 'confirmed';
  return 'pending';
}

/** Ainda dá para responder? (o banco recusa depois que o evento começou). */
export function canRespond(startsAt: string, now: Date = new Date()): boolean {
  return Date.parse(startsAt) > now.getTime();
}

export const NOTE_MAX = 300;
export const UNAVAILABILITY_NOTE_MAX = 200;

export interface Period {
  starts_on: string;
  ends_on: string;
}

/** Erro do formulário de indisponibilidade (datas AAAA-MM-DD), ou `null` se estiver certo. */
export function periodError(startsOn: string, endsOn: string): string | null {
  if (!startsOn || !endsOn) return 'Informe o primeiro e o último dia.';
  if (endsOn < startsOn) return 'O último dia não pode ser antes do primeiro.';
  return null;
}

/** O dia (AAAA-MM-DD, horário de Brasília) cai dentro de algum período? */
export function isUnavailableOn(periods: readonly Period[], day: string): boolean {
  return periods.some((p) => p.starts_on <= day && day <= p.ends_on);
}

/** "12/12" ou "12/12 a 15/12" (o ano só aparece se não for o do `now`). */
export function formatPeriod(period: Period, now: Date = new Date()): string {
  const year = String(now.getFullYear());
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return y === year ? `${d}/${m}` : `${d}/${m}/${y}`;
  };
  return period.starts_on === period.ends_on
    ? fmt(period.starts_on)
    : `${fmt(period.starts_on)} a ${fmt(period.ends_on)}`;
}

/** Períodos que ainda não terminaram, do mais próximo ao mais distante. */
export function upcomingPeriods<T extends Period>(periods: readonly T[], today: string): T[] {
  return periods
    .filter((p) => p.ends_on >= today)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
}
