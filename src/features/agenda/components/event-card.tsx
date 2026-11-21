import { ChevronRight, Clock, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { formatTimeRange } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { EventSummary } from '@/features/escalas';
import { CancelledBadge, EventTypeBadge } from '../event-type-badge';
import { EVENT_TYPE_STYLES } from '../event-type';

/**
 * Cartão de evento clicável (leva ao detalhe em /escalas/:id).
 * A borda esquerda e o selo usam a cor do tipo; o selo também tem ícone e texto.
 */
export function EventCard({
  event,
  dateLabel,
  children,
}: {
  event: EventSummary;
  /** Ex.: "dom., 23/11". Omitido quando a lista já está agrupada por dia. */
  dateLabel?: string;
  children?: ReactNode;
}) {
  const cancelled = event.status === 'cancelled';
  return (
    <Link
      to={`/escalas/${event.id}`}
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-l-4 bg-card p-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        EVENT_TYPE_STYLES[event.type].bar,
        cancelled && 'opacity-70',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-card-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <EventTypeBadge type={event.type} />
          {cancelled && <CancelledBadge />}
        </div>
        <span className={cn('font-semibold', cancelled && 'line-through')}>{event.title}</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden="true" className="size-3.5" />
            {dateLabel && <span>{dateLabel} ·</span>}
            {formatTimeRange(event.starts_at, event.ends_at)}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden="true" className="size-3.5" />
              {event.location}
            </span>
          )}
        </span>
        {children}
      </div>
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
