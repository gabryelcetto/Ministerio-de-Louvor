import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { nextOffset, pageRange } from '@/lib/paging';
import { useSession } from '@/features/auth';
import { supabase } from '@/services/supabase';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/** Só as do usuário logado: o RLS garante (user_id = auth.uid()). */
export async function fetchNotifications(offset = 0): Promise<NotificationItem[]> {
  const [from, to] = pageRange(offset);
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return data;
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

/** A API só permite atualizar a coluna read_at (GRANT de coluna no banco). */
export async function markAsRead(ids: string[] | 'all'): Promise<void> {
  const request = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  const { error } = ids === 'all' ? await request : await request.in('id', ids);
  if (error) throw error;
}

/** Link interno seguro: só caminhos do próprio app ("/escalas/..."). */
export function internalLink(link: string | null): string | null {
  if (!link) return null;
  return link.startsWith('/') && !link.startsWith('//') ? link : null;
}

export function unreadLabel(count: number): string {
  if (count === 0) return 'Nenhuma notificação nova';
  return count === 1 ? '1 notificação não lida' : `${count} notificações não lidas`;
}

const keys = {
  all: ['notifications'] as const,
  list: (userId?: string) => ['notifications', 'list', userId] as const,
  unread: (userId?: string) => ['notifications', 'unread', userId] as const,
};

export function useNotifications() {
  const { session } = useSession();
  const userId = session?.user.id;
  // "Carregar mais": páginas de 30; a tela recebe a lista já juntada.
  return useInfiniteQuery({
    queryKey: keys.list(userId),
    queryFn: ({ pageParam }) => fetchNotifications(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => nextOffset(last, all),
    select: (data) => data.pages.flat(),
    enabled: Boolean(userId),
  });
}

/** Contador para o sino/menu. Atualiza a cada minuto enquanto o app está aberto. */
export function useUnreadCount() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: keys.unread(userId),
    queryFn: fetchUnreadCount,
    enabled: Boolean(userId),
    refetchInterval: 60_000,
  });
}

export function useMarkAsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: markAsRead,
    onSettled: async () => {
      // O painel inicial também mostra o contador de não lidas.
      await Promise.all([
        client.invalidateQueries({ queryKey: keys.all }),
        client.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
}
