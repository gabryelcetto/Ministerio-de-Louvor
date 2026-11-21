import { CalendarClock, Megaphone, Pin, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Fab } from '@/components/common/fab';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { ScreenHeader } from '@/components/layout/screen-header';
import { usePermission } from '@/features/auth';
import { formatDayLabel, formatTime } from '@/lib/dates';
import { ANNOUNCEMENTS_LIMIT, useAnnouncements, useMyReads, type AnnouncementItem } from '../api';

/** Comunicados: fixados primeiro, depois do mais recente. Toque abre o detalhe. */
export function AnnouncementsPage() {
  const query = useAnnouncements();
  const reads = useMyReads();
  const canManage = usePermission('announcements.manage');

  return (
    <>
      <ScreenHeader title="Comunicados" subtitle="Avisos do ministério." back="/mais" />
      <section className="mx-auto flex max-w-[45rem] flex-col gap-5 pb-20">
        {query.isPending ? (
          <LoadingState label="Carregando comunicados…" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : query.data.length === 0 ? (
          <EmptyState>Nenhum comunicado por enquanto.</EmptyState>
        ) : (
          <>
            <ul aria-label="Comunicados" className="flex flex-col gap-3">
              {query.data.map((a) => (
                <li key={a.id}>
                  <AnnouncementCard
                    item={a}
                    // Sem saber ainda o que já foi lido, nada aparece como "Novo".
                    unread={reads.data ? !reads.data.has(a.id) : false}
                  />
                </li>
              ))}
            </ul>
            {query.data.length >= ANNOUNCEMENTS_LIMIT && (
              <p className="text-center text-sm text-muted-foreground">
                Mostrando os {ANNOUNCEMENTS_LIMIT} mais recentes.
              </p>
            )}
          </>
        )}
      </section>
      {canManage && <Fab to="/comunicados/novo" label="Novo comunicado" icon={Plus} />}
    </>
  );
}

function AnnouncementCard({ item, unread }: { item: AnnouncementItem; unread: boolean }) {
  return (
    <Link
      to={`/comunicados/${item.id}`}
      className="flex flex-col gap-2 rounded-2xl border bg-card p-4 transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Megaphone aria-hidden="true" className="size-3.5" />
          <time dateTime={item.publishedAt}>
            {formatDayLabel(item.publishedAt)}, {formatTime(item.publishedAt)}
          </time>
        </span>
        {item.author && <span>por {item.author}</span>}
        {unread && (
          <span className="rounded-md bg-brand px-2 py-0.5 font-bold text-brand-ink">Novo</span>
        )}
        {item.pinned && (
          <span className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 font-semibold text-brand-text">
            <Pin aria-hidden="true" className="size-3.5" />
            Fixado
          </span>
        )}
        {item.scheduled && (
          <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            Agendado — ainda não visível aos integrantes
          </span>
        )}
      </span>
      <span className="text-card-title">{item.title}</span>
      {item.body && (
        <span className="line-clamp-3 text-sm whitespace-pre-line text-muted-foreground">
          {item.body}
        </span>
      )}
    </Link>
  );
}
