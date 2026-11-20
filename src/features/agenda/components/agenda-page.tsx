import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { formatDayLabel, groupByDay } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { EventType } from '@/types/app.types';
import { AGENDA_DAYS, useAgenda, type AgendaItem } from '../api';
import { EVENT_TYPE_STYLES } from '../event-type';
import { EventCard } from './event-card';

type Filter = EventType | 'todos';

const FILTERS: Filter[] = ['todos', 'culto', 'ensaio', 'evento'];

/** Agenda: eventos agrupados por dia; tipo diferenciado por cor, ícone e rótulo. */
export function AgendaPage() {
  const query = useAgenda();
  const [filter, setFilter] = useState<Filter>('todos');

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Cultos, ensaios e eventos dos próximos {AGENDA_DAYS} dias.
        </p>
      </header>

      <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-2">
        {FILTERS.map((value) => {
          const style = value === 'todos' ? null : EVENT_TYPE_STYLES[value];
          const Icon = style?.icon;
          const active = filter === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(value)}
              className={cn(
                'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? (style?.badge ?? 'bg-primary text-primary-foreground') + ' border-transparent'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {Icon && <Icon aria-hidden="true" className="size-4" />}
              {style ? `${style.label}s` : 'Todos'}
            </button>
          );
        })}
      </div>

      {query.isPending ? (
        <LoadingState label="Carregando agenda…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <AgendaList
          items={filter === 'todos' ? query.data : query.data.filter((e) => e.type === filter)}
        />
      )}
    </section>
  );
}

function AgendaList({ items }: { items: AgendaItem[] }) {
  if (items.length === 0) return <EmptyState>Nenhum evento no período.</EmptyState>;

  return (
    <div className="flex flex-col gap-6">
      {groupByDay(items, (e) => e.starts_at).map(({ day, items: dayItems }) => {
        const first = dayItems[0];
        if (!first) return null;
        const headingId = `dia-${day}`;
        return (
          <section key={day} aria-labelledby={headingId} className="flex flex-col gap-2">
            <h2
              id={headingId}
              className="sticky top-0 z-10 bg-background/95 py-1 text-sm font-semibold text-muted-foreground backdrop-blur"
            >
              {formatDayLabel(first.starts_at)}
            </h2>
            <ul className="flex flex-col gap-2">
              {dayItems.map((event) => (
                <li key={event.id}>
                  <EventCard event={event}>
                    {event.scheduled && (
                      <span className="self-start rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
                        Você está escalado(a)
                      </span>
                    )}
                  </EventCard>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
