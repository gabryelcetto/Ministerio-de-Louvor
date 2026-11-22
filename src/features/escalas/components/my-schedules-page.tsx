import { AlertTriangle, CalendarPlus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { EventCard } from '@/features/agenda';
import { usePermission } from '@/features/auth';
import { formatShortDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { PAST_DAYS, type ScheduleOverview } from '../api';
import { useAllSchedules, useMySchedules } from '../hooks';
import { eventIssues } from '../pending';
import { canRespond } from '../presence';
import { splitByTime, type MyScheduleItem } from '../schedule-utils';
import { PresenceActions, ResponseBadge } from './presence-actions';

type View = 'minhas' | 'todas';
type Period = 'proximas' | 'anteriores';

/**
 * Escalas: abas "Minhas" | "Todas" ("Todas" só para quem monta escala) e "Próximas" |
 * "Anteriores". Em "Todas", cada evento mostra as pendências escritas ("Sem equipe", "Sem
 * repertório"), com o filtro "Só com pendência". A escolha fica no endereço.
 */
export function MySchedulesPage() {
  const canSchedule = usePermission('schedules.manage');
  const [params, setParams] = useSearchParams();
  const view: View = canSchedule && params.get('ver') === 'todas' ? 'todas' : 'minhas';
  const period: Period = params.get('periodo') === 'anteriores' ? 'anteriores' : 'proximas';
  const onlyPending = params.get('pendencia') === '1';

  const set = (key: string, value: string | null) =>
    setParams(
      (p) => {
        if (value === null) p.delete(key);
        else p.set(key, value);
        return p;
      },
      { replace: true },
    );

  return (
    <section className="mx-auto flex max-w-[45rem] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-screen-title">Escalas</h1>
          <p className="text-sm text-muted-foreground">
            {view === 'minhas'
              ? 'Eventos em que você está escalado(a) e a sua função em cada um.'
              : 'Todos os eventos, com o que falta resolver.'}
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

      {canSchedule && (
        <Segmented
          label="Escalas"
          value={view}
          options={[
            ['minhas', 'Minhas'],
            ['todas', 'Todas'],
          ]}
          onChange={(v) => set('ver', v === 'todas' ? 'todas' : null)}
        />
      )}
      <Segmented
        label="Período"
        value={period}
        options={[
          ['proximas', 'Próximas'],
          ['anteriores', 'Anteriores'],
        ]}
        onChange={(v) => set('periodo', v === 'anteriores' ? 'anteriores' : null)}
      />

      {view === 'minhas' ? (
        <MineView period={period} />
      ) : (
        <AllView
          period={period}
          onlyPending={onlyPending}
          onOnlyPendingChange={(v) => set('pendencia', v ? '1' : null)}
        />
      )}
    </section>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'min-h-11 rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === v ? 'bg-card shadow-sm' : 'text-muted-foreground',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function MineView({ period }: { period: Period }) {
  const query = useMySchedules();
  if (query.isPending) return <LoadingState label="Carregando suas escalas…" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const { upcoming, past } = splitByTime(query.data);
  const items = period === 'proximas' ? upcoming : past;
  if (items.length === 0) {
    return (
      <EmptyState>
        {period === 'proximas'
          ? 'Você não está escalado(a) em nenhum evento futuro.'
          : `Nenhuma escala nos últimos ${PAST_DAYS} dias.`}
      </EmptyState>
    );
  }
  return <ScheduleList items={items} />;
}

function ScheduleList({ items }: { items: MyScheduleItem[] }) {
  return (
    <ul aria-label="Minhas escalas" className="flex flex-col gap-3">
      {items.map(({ event, functions, notes, response, assignmentIds }) => (
        <li key={event.id} className="flex flex-col gap-2">
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
            <ResponseBadge response={response} />
          </EventCard>
          {event.status === 'scheduled' && canRespond(event.starts_at) && (
            <PresenceActions
              assignmentIds={assignmentIds}
              startsAt={event.starts_at}
              response={response}
              eventTitle={event.title}
              showStatus={false}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function AllView({
  period,
  onlyPending,
  onOnlyPendingChange,
}: {
  period: Period;
  onlyPending: boolean;
  onOnlyPendingChange: (value: boolean) => void;
}) {
  const query = useAllSchedules(period, true);
  if (query.isPending) return <LoadingState label="Carregando escalas…" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const now = new Date();
  const rows = query.data.map((row) => ({
    ...row,
    issues: eventIssues(
      {
        type: row.event.type,
        status: row.event.status,
        startsAt: row.event.starts_at,
        teamCount: row.teamCount,
        songCount: row.songCount,
        declinedCount: row.declinedCount,
      },
      now,
    ),
  }));
  const shown = onlyPending ? rows.filter((r) => r.issues.length > 0) : rows;

  return (
    <>
      {period === 'proximas' && (
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => onOnlyPendingChange(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          Só com pendência
        </label>
      )}
      {shown.length === 0 ? (
        <EmptyState>
          {onlyPending ? 'Nenhum evento com pendência. Tudo certo!' : 'Nenhum evento no período.'}
        </EmptyState>
      ) : (
        <ul aria-label="Todas as escalas" className="flex flex-col gap-3">
          {shown.map((row) => (
            <li key={row.event.id}>
              <OverviewCard row={row} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function OverviewCard({ row }: { row: ScheduleOverview & { issues: string[] } }) {
  return (
    <EventCard event={row.event} dateLabel={formatShortDate(row.event.starts_at)}>
      <span className="text-caption text-muted-foreground">
        {row.teamCount === 1 ? '1 pessoa' : `${row.teamCount} pessoas`} ·{' '}
        {row.songCount === 1 ? '1 música' : `${row.songCount} músicas`}
      </span>
      {row.issues.length > 0 && (
        <span className="flex flex-wrap gap-1.5">
          <span className="sr-only">Pendências:</span>
          {row.issues.map((issue) => (
            <span
              key={issue}
              className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-text"
            >
              <AlertTriangle aria-hidden="true" className="size-3.5" />
              {issue}
            </span>
          ))}
        </span>
      )}
    </EventCard>
  );
}
