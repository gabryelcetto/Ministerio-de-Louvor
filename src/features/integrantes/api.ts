import { useQuery } from '@tanstack/react-query';
import { displayName } from '@/features/escalas/schedule-utils';
import { usePermission } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import type { AccessRole, ProfileStatus } from '@/types/app.types';
import { sectionsOf, type Section } from './sections';

export interface MemberRow {
  id: string;
  full_name: string;
  display_name: string | null;
  access_role: AccessRole;
  is_owner: boolean;
  status: ProfileStatus;
  member_functions: { function: { name: string; sort_order: number; section: string } | null }[];
}

export interface Member {
  id: string;
  name: string;
  fullName: string;
  role: AccessRole;
  /** Dono do ministério (ninguém redefine a senha dele pela tela de integrantes). */
  isOwner: boolean;
  active: boolean;
  functions: string[];
  /** Cantor(a) e/ou Instrumentista (só selo; não dá permissão). */
  sections: Section[];
  phone: string | null;
}

/** Nunca pede `phone` aqui: a coluna não é legível pela API (GRANT de coluna). */
export async function fetchMembers(): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, display_name, access_role, is_owner, status, member_functions(function:ministry_functions(name, sort_order, section))',
    );
  if (error) throw error;
  return data;
}

/** Telefones via RPC: o banco só devolve os de todos para quem tem members.view_contacts. */
export async function fetchContacts(): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc('get_member_contacts');
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data) if (row.phone?.trim()) map.set(row.id, row.phone.trim());
  return map;
}

/** Junta perfis, funções (ordem do ministério) e telefones; ordena por nome. */
export function buildMembers(
  rows: readonly MemberRow[],
  phones: ReadonlyMap<string, string> | null,
): Member[] {
  return rows
    .map((row) => ({
      id: row.id,
      name: displayName(row),
      fullName: row.full_name.trim(),
      role: row.access_role,
      isOwner: row.is_owner,
      active: row.status === 'active',
      sections: sectionsOf(row.member_functions.map((mf) => mf.function).filter((f) => f !== null)),
      functions: row.member_functions
        .map((mf) => mf.function)
        .filter((f): f is { name: string; sort_order: number; section: string } => f !== null)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'pt-BR'))
        .map((f) => f.name),
      phone: phones?.get(row.id) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** Busca por nome sem acento e sem diferenciar maiúsculas. */
export function matchesName(member: Pick<Member, 'name' | 'fullName'>, query: string): boolean {
  const normalize = (v: string) =>
    v
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const q = normalize(query.trim());
  return !q || normalize(member.name).includes(q) || normalize(member.fullName).includes(q);
}

/** "tel:" só com dígitos e "+" (o telefone é texto livre no banco). */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 8 ? `tel:${digits}` : null;
}

export const ROLE_LABEL: Record<AccessRole, string | null> = {
  admin: 'Administração',
  leader: null, // valor antigo do banco, não usado (ADVOP: só admin e member)
  member: null,
};

export function useMembers() {
  const canViewContacts = usePermission('members.view_contacts');
  const members = useQuery({ queryKey: ['members', 'list'], queryFn: fetchMembers });
  const contacts = useQuery({
    queryKey: ['members', 'contacts'],
    queryFn: fetchContacts,
    // Sem a permissão nem consulta (o banco devolveria só o próprio telefone).
    enabled: canViewContacts,
  });
  return { members, contacts, canViewContacts };
}
