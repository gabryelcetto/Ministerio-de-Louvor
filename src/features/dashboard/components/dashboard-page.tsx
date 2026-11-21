import { CalendarDays, ChevronRight, Clock, MapPin, Megaphone, Pin, Music } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { useMyProfile } from '@/features/auth';
import { SongRow, useEventDetail } from '@/features/escalas';
import { InstallTip } from '@/features/instalar';
import { useMyFunctions } from '@/features/integrantes';
import { formatDayLabel, formatTime, formatTimeRange, greeting } from '@/lib/dates';
import type { Dashboard } from '@/types/app.types';
import { groupDashboardAssignments, useDashboard, type DashboardScheduleItem } from '../api';
import { describeMyRole } from '../my-role';

/**
 * Início: saudação, "Sua próxima escala" em destaque com o repertório no tom do dia, o
 * próximo ensaio e até 2 comunicados. As notificações ficam só no sino do topo.
 */
export function DashboardPage() {
  const { data: profile } = useMyProfile();
  const query = useDashboard();
  const name = profile?.display_name || profile?.full_name;

  return (
    <section className="mx-auto flex max-w-[45rem] flex-col gap-6">
      <h1 className="text-screen-title">
        {greeting()}
        {name ? `, ${name}` : ''}
      </h1>

      <InstallTip />

      {query.isPending ? (
        <LoadingState label="Carregando o início…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <DashboardContent data={query.data} />
      )}
    </section>
  );
}

function DashboardContent({ data }: { data: Dashboard }) {
  const next = groupDashboardAssignments(data.my_assignments)[0];
  const rehearsal =
    data.next_rehearsal && data.next_rehearsal.id !== next?.eventId ? data.next_rehearsal : null;
  const announcements = data.recent_announcements.slice(0, 2);

  return (
    <>
      {next ? (
        <NextSchedule item={next} />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-6 text-center">
          <CalendarDays aria-hidden="true" className="size-8 text-muted-foreground" />
          <p className="font-semibold">Você não está em nenhuma escala por enquanto.</p>
          <p className="text-sm text-muted-foreground">
            Quando a liderança escalar você, ela aparece aqui e no sino.
          </p>
          <Button asChild variant="outline">
            <Link to="/agenda">Ver a agenda</Link>
          </Button>
        </div>
      )}

      {rehearsal && (
        <Link
          to={`/escalas/${rehearsal.id}`}
          className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="section-label">Próximo ensaio</span>
            <span className="text-card-title">{rehearsal.title}</span>
            <span className="text-sm text-muted-foreground">
              {formatDayLabel(rehearsal.starts_at)} · {formatTime(rehearsal.starts_at)}
              {rehearsal.location ? ` · ${rehearsal.location}` : ''}
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
        </Link>
      )}

      {announcements.length > 0 && (
        <section aria-labelledby="inicio-comunicados" className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 id="inicio-comunicados" className="section-label">
              Comunicados
            </h2>
            <Link
              to="/comunicados"
              className="rounded-lg px-2 py-2 text-sm font-semibold text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ver todos
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {announcements.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/comunicados/${a.id}`}
                  className="flex gap-3 rounded-xl border bg-card p-4 hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {a.pinned ? (
                    <Pin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-text" />
                  ) : (
                    <Megaphone
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                    />
                  )}
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-semibold">
                      {a.title}
                      {a.pinned && <span className="sr-only"> (fixado)</span>}
                    </span>
                    <span className="line-clamp-2 text-sm whitespace-pre-line text-muted-foreground">
                      {a.body}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Card de destaque: claro = fundo ink com texto claro; escuro = surface com borda accent. */
function NextSchedule({ item }: { item: DashboardScheduleItem }) {
  const detail = useEventDetail(item.eventId);
  const myFunctions = useMyFunctions();
  const sectionOf = new Map((myFunctions.data ?? []).map((f) => [f.name, f.section] as const));
  const role = describeMyRole(
    item.functions.map((name) => ({ name, section: sectionOf.get(name) ?? null })),
  );
  const endsAt = detail.data?.event.ends_at ?? null;
  const songs = detail.data?.songs ?? [];

  return (
    <div className="flex flex-col gap-3">
      <article
        aria-labelledby="proxima-escala"
        className="flex flex-col gap-3 rounded-xl border border-ink bg-ink p-5 text-surface dark:border-brand dark:bg-surface dark:text-ink"
      >
        <p className="text-xs font-bold tracking-[0.06em] text-surface/75 uppercase dark:text-muted-foreground">
          Sua próxima escala
        </p>
        <h2 id="proxima-escala" className="text-[1.375rem] leading-tight font-extrabold">
          {item.title}
        </h2>
        <dl className="flex flex-col gap-1 text-sm text-surface/85 dark:text-muted-foreground">
          <Info icon={CalendarDays} label="Data">
            {formatDayLabel(item.startsAt)}
          </Info>
          <Info icon={Clock} label="Horário">
            {formatTimeRange(item.startsAt, endsAt)}
          </Info>
          {item.location && (
            <Info icon={MapPin} label="Local">
              {item.location}
            </Info>
          )}
        </dl>
        <p className="text-[0.9375rem] font-bold">{role}</p>
        <Button asChild className="self-start">
          <Link to={`/escalas/${item.eventId}#repertorio`}>
            <Music aria-hidden="true" />
            Ver repertório
          </Link>
        </Button>
      </article>

      {songs.length > 0 && (
        <section
          aria-label={`Repertório de ${item.title}`}
          className="rounded-xl border bg-card p-2"
        >
          <ol className="flex flex-col">
            {songs.map((song) => (
              <li key={song.id}>
                <SongRow song={song} eventId={item.eventId} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <dt className="sr-only">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
