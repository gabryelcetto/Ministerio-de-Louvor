import { CalendarPlus } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { EventCard } from '@/features/agenda/components/event-card';
import { formatShortDate } from '@/lib/dates';
import { usePermission } from '@/lib/permissions';
import { PAST_DAYS } from '../api';
import { useMySchedules } from '../hooks';
import { splitByTime, type MyScheduleItem } from '../schedule-utils';

/** "Minhas escalas": próximas primeiro; as anteriores ficam numa seção recolhida. */
export function MySchedulesPage() {
  const query = useMySchedules();
  const canSchedule = usePermission('schedules.manage');

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Minhas escalas</h1>
          <p className="text-sm text-muted-foreground">
            Eventos em que você está escalado(a) e a sua função em cada um.
          </p>
        </div>
        {canSchedule && (
          <Button asChild>
            <Link to="/escalas/montar">
              <CalendarPlus aria-hidden="true" />
              Montar escala
            </Link>
          </Button>
        )}
      </header>

      {query.isPending ? (
        <LoadingState label="Carregando suas escalas…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <ScheduleLists items={query.data} />
      )}
    </section>
  );
}

function ScheduleLists({ items }: { items: MyScheduleItem[] }) {
  const { upcoming, past } = splitByTime(items);

  return (
    <>
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Próximas</h2>
        {upcoming.length === 0 ? (
          <EmptyState>Você não está escalado(a) em nenhum evento futuro.</EmptyState>
        ) : (
          <ScheduleList items={upcoming} />
        )}
      </div>

      {past.length > 0 && (
        <details className="group flex flex-col gap-3">
          <summary className="cursor-pointer rounded-md py-1 text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Anteriores{' '}
            <span className="text-sm font-normal text-muted-foreground">
              (últimos {PAST_DAYS} dias)
            </span>
          </summary>
          <div className="mt-3">
            <ScheduleList items={past} />
          </div>
        </details>
      )}
    </>
  );
}

function ScheduleList({ items }: { items: MyScheduleItem[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map(({ event, functions, notes }) => (
        <li key={event.id}>
          <EventCard event={event} dateLabel={formatShortDate(event.starts_at)}>
            <span className="flex flex-wrap gap-1.5">
              <span className="sr-only">Suas funções:</span>
              {functions.map((fn) => (
                <span
                  key={fn}
                  className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                >
                  {fn}
                </span>
              ))}
            </span>
            {notes.length > 0 && (
              <span className="text-sm text-muted-foreground">Obs.: {notes.join(' · ')}</span>
            )}
          </EventCard>
        </li>
      ))}
    </ul>
  );
}
