import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchEventDetail } from '@/features/escalas/api';
import { useMySchedules } from '@/features/escalas/hooks';
import { splitByTime } from '@/features/escalas/schedule-utils';
import { fetchSong } from '@/features/repertorio/api';
import { useOnline } from '@/hooks/use-online';

/** Quantas escalas à frente têm as músicas baixadas para o modo offline. */
export const PRELOAD_EVENTS = 2;
const FRESH_MS = 5 * 60_000;

/**
 * Modo offline (Fase H, item 18): baixa o evento e as músicas das minhas próximas escalas.
 * Ficam no cache das consultas, que é salvo no aparelho (src/lib/offline-cache.ts).
 */
export function usePreloadNextSongs() {
  const client = useQueryClient();
  const online = useOnline();
  const mine = useMySchedules();
  const ids = splitByTime(mine.data ?? [])
    .upcoming.filter((item) => item.event.status === 'scheduled')
    .slice(0, PRELOAD_EVENTS)
    .map((item) => item.event.id);
  const key = ids.join(',');

  useEffect(() => {
    if (!online || !key) return;
    let cancelled = false;
    void (async () => {
      for (const id of key.split(',')) {
        const detail = await client.fetchQuery({
          queryKey: ['events', 'detail', id],
          queryFn: () => fetchEventDetail(id),
          staleTime: FRESH_MS,
        });
        for (const song of detail?.songs ?? []) {
          if (cancelled) return;
          if (!song.songId) continue;
          await client.prefetchQuery({
            queryKey: ['songs', 'detail', song.songId],
            queryFn: () => fetchSong(song.songId),
            staleTime: FRESH_MS,
          });
        }
      }
    })().catch(() => {
      // Sem rede no meio do caminho: tenta de novo na próxima vez.
    });
    return () => {
      cancelled = true;
    };
  }, [client, key, online]);
}
