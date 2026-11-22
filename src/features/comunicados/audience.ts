/**
 * "Para quem" de um comunicado — o mesmo formato de announcements.audience_filter no banco.
 * Quem recebe de fato é decidido pelo banco (save_announcement: só integrantes ativos); aqui ficam
 * a validação do formulário, os textos e a seleção de pessoas.
 */
import { z } from 'zod';
import { SECTION_FILTER_LABEL, type Section } from '@/features/integrantes';

export type AudienceFilter =
  | { type: 'all' }
  | { type: 'groups'; sections: Section[]; function_ids: number[] }
  | { type: 'event'; event_id: string }
  | { type: 'users'; user_ids: string[] };

export type AudienceType = AudienceFilter['type'];

export const AUDIENCE_TYPE_LABEL: Record<AudienceType, string> = {
  all: 'Todos',
  groups: 'Grupos e funções',
  event: 'Escalados de um evento',
  users: 'Pessoas escolhidas',
};

const sectionSchema = z.enum(['vocal', 'instrumental']);
export const audienceFilterSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('all') }),
  z.object({
    type: z.literal('groups'),
    sections: z.array(sectionSchema).default([]),
    function_ids: z.array(z.number().int()).default([]),
  }),
  z.object({ type: z.literal('event'), event_id: z.uuid() }),
  z.object({ type: z.literal('users'), user_ids: z.array(z.uuid()).default([]) }),
]);

/** Lê o que veio do banco; qualquer coisa estranha vira "Todos" (nunca quebra a tela). */
export function parseAudienceFilter(value: unknown): AudienceFilter {
  const parsed = audienceFilterSchema.safeParse(value);
  return parsed.success ? parsed.data : { type: 'all' };
}

/** Filtro vazio ao trocar o tipo no formulário. */
export function emptyFilter(type: AudienceType): AudienceFilter {
  switch (type) {
    case 'groups':
      return { type, sections: [], function_ids: [] };
    case 'event':
      return { type, event_id: '' };
    case 'users':
      return { type, user_ids: [] };
    default:
      return { type: 'all' };
  }
}

/** O que falta escolher (null = pronto para publicar). */
export function audienceProblem(filter: AudienceFilter): string | null {
  switch (filter.type) {
    case 'groups':
      return filter.sections.length + filter.function_ids.length === 0
        ? 'Escolha pelo menos um grupo ou função.'
        : null;
    case 'event':
      return filter.event_id ? null : 'Escolha o evento.';
    case 'users':
      return filter.user_ids.length === 0 ? 'Escolha pelo menos uma pessoa.' : null;
    default:
      return null;
  }
}

/** "Vai para 1 pessoa" / "Vai para 12 pessoas" / "Ninguém recebe ainda". */
export function recipientsLabel(count: number): string {
  if (count <= 0) return 'Ninguém recebe ainda';
  return `Vai para ${count} ${count === 1 ? 'pessoa' : 'pessoas'}`;
}

/** "Visto por 8 de 12". */
export function seenLabel(seen: number, total: number): string {
  return `Visto por ${seen} de ${total}`;
}

/** Resumo do público para o detalhe ("Cantores e Bateria", "3 pessoas"…). */
export function audienceSummary(
  filter: AudienceFilter,
  names: { functions?: ReadonlyMap<number, string>; events?: ReadonlyMap<string, string> } = {},
): string {
  switch (filter.type) {
    case 'all':
      return 'Todos';
    case 'groups':
      return joinList([
        ...filter.sections.map((s) => SECTION_FILTER_LABEL[s]),
        ...filter.function_ids.map((id) => names.functions?.get(id) ?? 'uma função'),
      ]);
    case 'event':
      return `Escalados: ${names.events?.get(filter.event_id) ?? 'um evento'}`;
    case 'users':
      return filter.user_ids.length === 1 ? '1 pessoa' : `${filter.user_ids.length} pessoas`;
  }
}

/** "a", "a e b", "a, b e c". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** Marca/desmarca um item numa lista (sem repetir, mantendo a ordem). */
export function toggleId<T>(list: readonly T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** "Selecionar todos do resultado": junta sem repetir. */
export function addAll<T>(list: readonly T[], ids: readonly T[]): T[] {
  return [...list, ...ids.filter((id) => !list.includes(id))];
}

export type PinOption = 'none' | '3' | '7' | '30';
export const PIN_LABEL: Record<PinOption, string> = {
  none: 'Não fixar',
  '3': 'Fixar por 3 dias',
  '7': 'Fixar por 7 dias',
  '30': 'Fixar por 30 dias',
};

/** Até quando fica fixado (null = não fixar). */
export function pinnedUntil(option: PinOption, now: Date = new Date()): string | null {
  if (option === 'none') return null;
  return new Date(now.getTime() + Number(option) * 86_400_000).toISOString();
}

export function isPinned(until: string | null | undefined, now: Date = new Date()): boolean {
  return !!until && Date.parse(until) > now.getTime();
}
