/**
 * Pendências de um evento na visão do admin ("Todas" as escalas e "Precisa de atenção" no
 * Início). As mesmas regras estão no get_dashboard do banco:
 *   - "Sem equipe": ninguém escalado;
 *   - "Sem repertório": culto sem nenhuma música (ensaio e evento podem não ter);
 *   - "N recusas": pessoas que responderam "Não posso" (Fase H).
 * Evento cancelado ou que já passou não tem pendência.
 */
import type { EventType } from '@/types/app.types';

export interface IssueInput {
  type: EventType;
  status: 'scheduled' | 'cancelled';
  startsAt: string;
  teamCount: number;
  songCount: number;
  declinedCount?: number;
}

export function eventIssues(event: IssueInput, now: Date = new Date()): string[] {
  if (event.status === 'cancelled' || Date.parse(event.startsAt) < now.getTime()) return [];
  const issues: string[] = [];
  if (event.teamCount === 0) issues.push('Sem equipe');
  if (event.type === 'culto' && event.songCount === 0) issues.push('Sem repertório');
  const declined = event.declinedCount ?? 0;
  if (declined > 0) issues.push(declined === 1 ? '1 recusa' : `${declined} recusas`);
  return issues;
}
