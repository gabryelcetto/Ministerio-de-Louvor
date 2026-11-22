import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Fab } from '@/components/common/fab';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/features/auth';
import {
  addMonths,
  formatDayLabel,
  formatMonthLabel,
  groupByDay,
  isMonthKey,
  monthKey,
} from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { EventType } from '@/types/app.types';
import { isPastEvent, useAgendaMonth, type AgendaItem } from '../api';
import { EVENT_TYPE_STYLES } from '../event-type';
import { EventCard } from './event-card';

type Filter = EventType | 'todos';

const FILTERS: Filter[] = ['todos', 'culto', 'ensaio', 'evento'];

/**
 * Agenda por mês (‹ novembro de 2026 ›) com "Hoje". Meses passados também abrem; eventos que já
 * aconteceram ficam esmaecidos e continuam abrindo o detalhe (com as gravações do ensaio).
 * O mês fica no endereço (?mes=2026-11): o Voltar devolve ao mesmo mês.
 */
export function AgendaPage() {
  const [params, setParams] = useSearchParams();
  const today = monthKey();
  const requested = params.get('mes');
  const month = isMonthKey(requested) ? requested : today;
  const query = useAgendaMonth(month);
  const [filter, setFilter] = useState<Filter>('todos');
  const canCreate = usePermission('events.manage');
  const label = formatMonthLabel(month);

  const go = (next: string) =>
    setParams(
      (p) => {
        if (next === today) p.delete('mes');
        else p.set('mes', next);
        return p;
      },
      { replace: true },
    );

  return (
    <section className="mx-auto flex max-w-[45rem] flex-col gap-5 pb-20">
      <header className="flex flex-col gap-1">
        <h1 className="text-screen-title">Agenda</h1>
        <p className="text-sm text-muted-foreground">Cultos, ensaios e eventos do ministério.</p>
      </header>

      <nav aria-label="Mês" className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => go(addMonths(month, -1))}
          aria-label="Mês anterior"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <p aria-live="polite" className="min-w-0 flex-1 text-center text-card-title capitalize">
          {label}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => go(addMonths(month, 1))}
          aria-label="Próximo mês"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={month === today}
          onClick={() => go(today)}
        >
          Hoje
        </Button>
      </nav>

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
                'inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? (style?.badge ?? 'bg-brand-soft text-brand-text') + ' border-transparent'
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
          label={label}
          items={filter === 'todos' ? query.data : query.data.filter((e) => e.type === filter)}
        />
      )}
      {canCreate && <Fab to="/escalas/montar?novo=1" label="Novo evento" icon={Plus} />}
    </section>
  );
}

function AgendaList({ items, label }: { items: AgendaItem[]; label: string }) {
  if (items.length === 0) return <EmptyState>Nenhum evento em {label}.</EmptyState>;
  const now = new Date();

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
              {dayItems.map((event) => {
                const past = isPastEvent(event, now);
                return (
                  <li key={event.id}>
                    <EventCard event={event} past={past}>
                      {past && (
                        <span className="text-caption text-muted-foreground">Já aconteceu</span>
                      )}
                      {event.scheduled && (
                        <span className="self-start rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-semibold text-brand-text">
                          Você está escalado(a)
                        </span>
                      )}
                    </EventCard>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
