import { Bell, BellOff, CalendarX, Check, CheckCheck, UserMinus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { formatShortDate, formatTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import {
  internalLink,
  NOTIFICATIONS_LIMIT,
  unreadLabel,
  useMarkAsRead,
  useNotifications,
  type NotificationItem,
} from '../api';

const TYPE_ICONS: Record<string, typeof Bell> = {
  assignment_added: UserPlus,
  assignment_removed: UserMinus,
  event_cancelled: CalendarX,
  event_updated: Bell,
};

type Filter = 'todas' | 'nao-lidas';

export function NotificationsPage() {
  const query = useNotifications();
  const mark = useMarkAsRead();
  const [filter, setFilter] = useState<Filter>('todas');

  const unread = query.data?.filter((n) => !n.read_at).length ?? 0;
  const items = filter === 'nao-lidas' ? query.data?.filter((n) => !n.read_at) : query.data;

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Notificações</h1>
          {query.data && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {unreadLabel(unread)}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => mark.mutate('all')}
          disabled={unread === 0 || mark.isPending}
        >
          <CheckCheck aria-hidden="true" />
          Marcar todas como lidas
        </Button>
      </header>

      {mark.isError && (
        <ErrorState
          message="Não foi possível marcar como lida."
          onRetry={() => mark.variables && mark.mutate(mark.variables)}
        />
      )}

      <div role="group" aria-label="Filtrar notificações" className="flex gap-2">
        {(
          [
            ['todas', 'Todas'],
            ['nao-lidas', `Não lidas (${unread})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              'inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              filter === value
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {query.isPending ? (
        <LoadingState label="Carregando notificações…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : !items || items.length === 0 ? (
        <EmptyState>
          {filter === 'nao-lidas'
            ? 'Tudo em dia: nenhuma notificação não lida.'
            : 'Você ainda não recebeu notificações.'}
        </EmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationRow
                  item={n}
                  busy={mark.isPending}
                  onRead={() => mark.mutate([n.id])}
                />
              </li>
            ))}
          </ul>
          {query.data.length >= NOTIFICATIONS_LIMIT && (
            <p className="text-center text-sm text-muted-foreground">
              Mostrando as {NOTIFICATIONS_LIMIT} mais recentes.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function NotificationRow({
  item,
  busy,
  onRead,
}: {
  item: NotificationItem;
  busy: boolean;
  onRead: () => void;
}) {
  const unread = !item.read_at;
  const Icon = TYPE_ICONS[item.type] ?? (unread ? Bell : BellOff);
  const link = internalLink(item.link);

  const content = (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className={cn('text-sm', unread ? 'font-semibold' : 'text-muted-foreground')}>
        {unread && <span className="sr-only">Não lida: </span>}
        {item.title}
      </span>
      {item.body && <span className="text-sm text-muted-foreground">{item.body}</span>}
      <time dateTime={item.created_at} className="text-xs text-muted-foreground">
        {formatShortDate(item.created_at)} às {formatTime(item.created_at)}
      </time>
    </span>
  );

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3',
        unread ? 'border-accent bg-accent/10' : 'bg-card',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
          unread ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-4" />
      </span>
      {link ? (
        // Abrir a notificação também a marca como lida.
        <Link
          to={link}
          onClick={() => unread && onRead()}
          className="flex min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {content}
        </Link>
      ) : (
        content
      )}
      {unread && (
        <Button
          variant="ghost"
          size="icon"
          className="size-10 shrink-0"
          onClick={onRead}
          disabled={busy}
          aria-label={`Marcar como lida: ${item.title}`}
          title="Marcar como lida"
        >
          <Check aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
