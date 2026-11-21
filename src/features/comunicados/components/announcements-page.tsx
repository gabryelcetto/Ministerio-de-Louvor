import { CalendarClock, Megaphone } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { formatDayLabel, formatTime } from '@/lib/dates';
import { ANNOUNCEMENTS_LIMIT, useAnnouncements } from '../api';
import { ScreenHeader } from '@/components/layout/screen-header';

/** Comunicados do mais recente para o mais antigo. */
export function AnnouncementsPage() {
  const query = useAnnouncements();

  return (
    <>
      <ScreenHeader
        title="Comunicados"
        subtitle="Avisos da liderança, do mais recente."
        back="/mais"
      />
      <section className="mx-auto flex max-w-[45rem] flex-col gap-5">
        {query.isPending ? (
          <LoadingState label="Carregando comunicados…" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : query.data.length === 0 ? (
          <EmptyState>Nenhum comunicado por enquanto.</EmptyState>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {query.data.map((a) => (
                <li key={a.id}>
                  <article
                    aria-labelledby={`comunicado-${a.id}`}
                    className="flex flex-col gap-2 rounded-xl border bg-card p-4"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Megaphone aria-hidden="true" className="size-3.5" />
                        <time dateTime={a.publishedAt}>
                          {formatDayLabel(a.publishedAt)}, {formatTime(a.publishedAt)}
                        </time>
                      </span>
                      {a.author && <span>por {a.author}</span>}
                      {a.scheduled && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                          <CalendarClock aria-hidden="true" className="size-3.5" />
                          Agendado — ainda não visível aos integrantes
                        </span>
                      )}
                    </div>
                    <h2 id={`comunicado-${a.id}`} className="text-lg font-semibold">
                      {a.title}
                    </h2>
                    {a.body && <p className="text-sm whitespace-pre-line">{a.body}</p>}
                  </article>
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
    </>
  );
}
