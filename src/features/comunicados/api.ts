import { useQuery } from '@tanstack/react-query';
import { displayName } from '@/features/escalas';
import { supabase } from '@/services/supabase';

/** Quantos comunicados a tela mostra (os mais recentes). */
export const ANNOUNCEMENTS_LIMIT = 50;

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  author: string | null;
  /** Publicação agendada (só quem tem announcements.manage enxerga — regra do RLS). */
  scheduled: boolean;
}

export async function fetchAnnouncements(now: Date = new Date()): Promise<AnnouncementItem[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, published_at, author:profiles(full_name, display_name)')
    .order('published_at', { ascending: false })
    .limit(ANNOUNCEMENTS_LIMIT);
  if (error) throw error;
  return data.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    publishedAt: a.published_at,
    author: a.author ? displayName(a.author) : null,
    scheduled: Date.parse(a.published_at) > now.getTime(),
  }));
}

export function useAnnouncements() {
  return useQuery({ queryKey: ['announcements', 'list'], queryFn: () => fetchAnnouncements() });
}
