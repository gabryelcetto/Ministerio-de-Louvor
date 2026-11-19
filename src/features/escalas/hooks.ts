import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session-context';
import { fetchEventDetail, fetchMySchedules } from './api';

export function useMySchedules() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['schedules', 'mine', userId],
    queryFn: () => fetchMySchedules(userId as string),
    enabled: Boolean(userId),
  });
}

export function useEventDetail(eventId: string | undefined) {
  return useQuery({
    queryKey: ['events', 'detail', eventId],
    queryFn: () => fetchEventDetail(eventId as string),
    enabled: Boolean(eventId),
  });
}
