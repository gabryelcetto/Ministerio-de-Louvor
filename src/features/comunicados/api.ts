import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { nextOffset, pageRange } from '@/lib/paging';
import { useSession } from '@/features/auth';
import { displayName } from '@/features/escalas';
import { supabase } from '@/services/supabase';
import type { Json } from '@/types/app.types';
import { isPinned, parseAudienceFilter, type AudienceFilter } from './audience';

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  author: string | null;
  /** Publicação agendada (só quem tem announcements.manage enxerga — regra do RLS). */
  scheduled: boolean;
  pinnedUntil: string | null;
  pinned: boolean;
  filter: AudienceFilter;
}

interface AnnouncementDbRow {
  id: string;
  title: string;
  body: string;
  published_at: string;
  pinned_until: string | null;
  audience_filter: Json;
  author: { full_name: string; display_name: string | null } | null;
}

export function toAnnouncement(a: AnnouncementDbRow, now: Date = new Date()): AnnouncementItem {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    publishedAt: a.published_at,
    author: a.author ? displayName(a.author) : null,
    scheduled: Date.parse(a.published_at) > now.getTime(),
    pinnedUntil: a.pinned_until,
    pinned: isPinned(a.pinned_until, now),
    filter: parseAudienceFilter(a.audience_filter),
  };
}

/** Fixados primeiro; depois do mais recente para o mais antigo. */
export function sortAnnouncements(items: readonly AnnouncementItem[]): AnnouncementItem[] {
  return [...items].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
}

/** Uma página da lista, do mais recente para o mais antigo ("Carregar mais"). */
export async function fetchAnnouncements(
  offset = 0,
  now: Date = new Date(),
): Promise<AnnouncementItem[]> {
  const [from, to] = pageRange(offset);
  // "author:profiles!…_fkey": announcements liga a profiles também pelos destinatários e
  // leituras; a dica do nome da chave escolhe o autor.
  const { data, error } = await supabase
    .from('announcements')
    .select(
      'id, title, body, published_at, pinned_until, audience_filter, author:profiles!announcements_created_by_fkey(full_name, display_name)',
    )
    .order('published_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return data.map((a) => toAnnouncement(a, now));
}

/** Os fixados que ainda valem (vão no topo da lista). */
export async function fetchPinnedAnnouncements(
  now: Date = new Date(),
): Promise<AnnouncementItem[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select(
      'id, title, body, published_at, pinned_until, audience_filter, author:profiles!announcements_created_by_fkey(full_name, display_name)',
    )
    .gt('pinned_until', now.toISOString())
    .order('published_at', { ascending: false });
  if (error) throw error;
  return data.map((a) => toAnnouncement(a, now));
}

/** Fixados no topo + páginas, sem repetir (um fixado também aparece na sua página). */
export function mergeAnnouncements(
  pinned: readonly AnnouncementItem[],
  pages: readonly AnnouncementItem[],
): AnnouncementItem[] {
  const ids = new Set(pinned.map((a) => a.id));
  return [...sortAnnouncements(pinned), ...pages.filter((a) => !ids.has(a.id))];
}

/** Ids dos comunicados que a pessoa logada já abriu (o RLS devolve só as próprias leituras). */
export async function fetchMyReads(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('announcement_reads')
    .select('announcement_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set(data.map((r) => r.announcement_id));
}

export async function fetchAnnouncement(id: string): Promise<AnnouncementItem | null> {
  const { data, error } = await supabase
    .from('announcements')
    .select(
      'id, title, body, published_at, pinned_until, audience_filter, author:profiles!announcements_created_by_fkey(full_name, display_name)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toAnnouncement(data) : null;
}

export interface AudienceStatus {
  userId: string;
  name: string;
  readAt: string | null;
}

export async function fetchAudienceStatus(id: string): Promise<AudienceStatus[]> {
  const { data, error } = await supabase.rpc('get_announcement_audience_status', { p_id: id });
  if (error) throw error;
  return data.map((r) => ({
    userId: r.user_id,
    name: displayName({ full_name: r.full_name, display_name: r.display_name }),
    readAt: r.read_at,
  }));
}

export async function previewAudience(filter: AudienceFilter): Promise<number> {
  const { data, error } = await supabase.rpc('preview_announcement_audience', {
    p_filter: filter as unknown as Json,
  });
  if (error) throw error;
  return data;
}

export interface SaveAnnouncementInput {
  id: string | null;
  title: string;
  body: string;
  filter: AudienceFilter;
  pinnedUntil: string | null;
  /** ISO da publicação agendada; `null` = publicar agora (ou manter, se já publicado). */
  publishAt?: string | null;
}

export async function saveAnnouncement(input: SaveAnnouncementInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_announcement', {
    // null = novo comunicado (o gerador tipa uuid como string).
    p_id: input.id as string,
    p_title: input.title,
    p_body: input.body,
    p_filter: input.filter as unknown as Json,
    p_pinned_until: input.pinnedUntil as string,
    ...(input.publishAt ? { p_publish_at: input.publishAt } : {}),
  });
  if (error) throw error;
  return data;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_announcement', { p_id: id });
  if (error) throw error;
}

export async function markAnnouncementRead(id: string): Promise<void> {
  const { error } = await supabase.rpc('mark_announcement_read', { p_id: id });
  if (error) throw error;
}

export async function remindAnnouncement(id: string): Promise<number> {
  const { data, error } = await supabase.rpc('remind_announcement', { p_id: id });
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------------------------------ hooks
export function useAnnouncements() {
  const pinned = useQuery({
    queryKey: ['announcements', 'pinned'],
    queryFn: () => fetchPinnedAnnouncements(),
  });
  const pages = useInfiniteQuery({
    queryKey: ['announcements', 'list'],
    queryFn: ({ pageParam }) => fetchAnnouncements(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => nextOffset(last, all),
  });
  return {
    data:
      pinned.data && pages.data
        ? mergeAnnouncements(pinned.data, pages.data.pages.flat())
        : undefined,
    isPending: pinned.isPending || pages.isPending,
    isError: pinned.isError || pages.isError,
    refetch: () => Promise.all([pinned.refetch(), pages.refetch()]),
    hasNextPage: pages.hasNextPage,
    isFetchingNextPage: pages.isFetchingNextPage,
    isFetchNextPageError: pages.isFetchNextPageError,
    fetchNextPage: () => pages.fetchNextPage(),
  };
}

export function useMyReads() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['announcements', 'my-reads', userId],
    queryFn: () => fetchMyReads(userId as string),
    enabled: !!userId,
  });
}

export function useAnnouncement(id: string) {
  return useQuery({
    queryKey: ['announcements', 'detail', id],
    queryFn: () => fetchAnnouncement(id),
    enabled: id !== '',
  });
}

export function useAudienceStatus(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['announcements', 'audience', id],
    queryFn: () => fetchAudienceStatus(id),
    enabled,
  });
}

export function useAudiencePreview(filter: AudienceFilter, enabled: boolean) {
  return useQuery({
    queryKey: ['announcements', 'preview', filter],
    queryFn: () => previewAudience(filter),
    enabled,
  });
}

function useInvalidateAnnouncements() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['announcements'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
      client.invalidateQueries({ queryKey: ['notifications'] }),
    ]);
}

export function useSaveAnnouncement() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({ mutationFn: saveAnnouncement, onSuccess: invalidate });
}

export function useDeleteAnnouncement() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({ mutationFn: deleteAnnouncement, onSuccess: invalidate });
}

export function useMarkAnnouncementRead() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({ mutationFn: markAnnouncementRead, onSuccess: invalidate });
}

export function useRemindAnnouncement(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => remindAnnouncement(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['announcements', 'audience', id] }),
  });
}

export interface UpcomingEvent {
  id: string;
  title: string;
  startsAt: string;
}

/** Próximos eventos (para "Escalados de um evento"). */
export async function fetchUpcomingEvents(now: Date = new Date()): Promise<UpcomingEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, starts_at')
    .eq('status', 'scheduled')
    .gte('starts_at', new Date(now.getTime() - 12 * 3_600_000).toISOString())
    .order('starts_at')
    .limit(30);
  if (error) throw error;
  return data.map((e) => ({ id: e.id, title: e.title, startsAt: e.starts_at }));
}

export function useUpcomingEvents(enabled: boolean) {
  return useQuery({
    queryKey: ['events', 'upcoming-picker'],
    queryFn: () => fetchUpcomingEvents(),
    enabled,
  });
}
