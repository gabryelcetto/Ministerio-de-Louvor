import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requireAffected } from '@/lib/errors';
import { displayName } from '@/features/escalas';
import { usePermission, useSession } from '@/features/auth';
import { supabase } from '@/services/supabase';
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

export interface MyFunction {
  name: string;
  sortOrder: number;
  section: Section;
}

/** Funções da pessoa logada, na ordem do ministério (Configurações e tela Mais). */
export async function fetchMyFunctions(userId: string): Promise<MyFunction[]> {
  const { data, error } = await supabase
    .from('member_functions')
    .select('function:ministry_functions(name, sort_order, section)')
    .eq('user_id', userId);
  if (error) throw error;
  return data
    .map((row) => row.function)
    .filter((f): f is { name: string; sort_order: number; section: string } => f !== null)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'pt-BR'))
    .map((f) => ({
      name: f.name,
      sortOrder: f.sort_order,
      section: f.section === 'vocal' ? 'vocal' : 'instrumental',
    }));
}

export function useMyFunctions() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['members', 'my-functions', userId],
    queryFn: () => fetchMyFunctions(userId as string),
    enabled: Boolean(userId),
  });
}

// ---------------------------------------------------------------------------------------------
// Fase G (itens 10 e 11): editar integrante, perfil de acesso, ativar/desativar, Minha conta.
// As proteções (dono, a si mesmo, último admin) ficam no banco (trigger em profiles).
// ---------------------------------------------------------------------------------------------

export interface MemberEditValues {
  fullName: string;
  displayName: string;
  phone: string;
  functionIds: number[];
}

export async function updateMember(userId: string, values: MemberEditValues): Promise<void> {
  const { error } = await supabase.rpc('update_member', {
    p_user_id: userId,
    p_full_name: values.fullName,
    p_display_name: values.displayName,
    p_phone: values.phone,
    p_function_ids: values.functionIds,
  });
  if (error) throw error;
}

export async function setMemberRole(userId: string, role: 'admin' | 'member'): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ access_role: role })
    .eq('id', userId)
    .select('id');
  if (error) throw error;
  requireAffected(data);
}

export async function setMemberActive(userId: string, active: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ status: active ? 'active' : 'inactive' })
    .eq('id', userId)
    .select('id');
  if (error) throw error;
  requireAffected(data);
}

/** Minha conta: a pessoa edita o próprio nome, apelido e telefone (o resto o banco barra). */
export async function updateMyAccount(
  userId: string,
  values: Pick<MemberEditValues, 'fullName' | 'displayName' | 'phone'>,
): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: values.fullName.trim(),
      display_name: values.displayName.trim() || null,
      phone: values.phone.trim() || null,
    })
    .eq('id', userId)
    .select('id');
  if (error) throw error;
  requireAffected(data);
}

function useInvalidateMembers() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['members'] }),
      client.invalidateQueries({ queryKey: ['me'] }),
    ]);
}

export function useUpdateMember(userId: string) {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (values: MemberEditValues) => updateMember(userId, values),
    onSuccess: invalidate,
  });
}

export function useSetMemberRole(userId: string) {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (role: 'admin' | 'member') => setMemberRole(userId, role),
    onSuccess: invalidate,
  });
}

export function useSetMemberActive(userId: string) {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (active: boolean) => setMemberActive(userId, active),
    onSuccess: invalidate,
  });
}

export function useUpdateMyAccount() {
  const { session } = useSession();
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (values: Pick<MemberEditValues, 'fullName' | 'displayName' | 'phone'>) =>
      updateMyAccount(session?.user.id as string, values),
    onSuccess: invalidate,
  });
}

/** Telefone da própria pessoa (get_member_contacts sempre devolve o próprio). */
export async function fetchMyPhone(userId: string): Promise<string> {
  const map = await fetchContacts();
  return map.get(userId) ?? '';
}

export function useMyPhone() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['members', 'my-phone', userId],
    queryFn: () => fetchMyPhone(userId as string),
    enabled: Boolean(userId),
  });
}
