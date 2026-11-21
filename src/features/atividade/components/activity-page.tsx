import { ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Label } from '@/components/ui/label';
import { useMyPermissions } from '@/features/auth/hooks/use-me';
import { formatShortDate, formatTime } from '@/lib/dates';
import { ACTIVITY_LIMIT, describeActivity, useActivity, useActivityFilters } from '../api';

const selectClass =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Atividade recente de todo o repertório (só history.view_all). Restaurar é no histórico da música. */
export function ActivityPage() {
  const permissions = useMyPermissions();
  if (permissions.isPending) return <LoadingState />;
  if (!permissions.data?.includes('history.view_all')) {
    return (
      <section className="mx-auto flex max-w-3xl flex-col gap-3">
        <h1 className="text-2xl font-semibold">Atividade recente</h1>
        <p role="alert" className="rounded-lg border p-4">
          Você não tem permissão para ver a atividade de todo o repertório.
        </p>
      </section>
    );
  }
  return <ActivityContent />;
}

function ActivityContent() {
  const id = useId();
  const [params, setParams] = useSearchParams();
  const actorId = params.get('pessoa');
  const songId = params.get('musica');
  const filters = useActivityFilters();
  const activity = useActivity(actorId, songId);

  const setFilter = (name: 'pessoa' | 'musica', value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Atividade recente</h1>
        <p className="text-sm text-muted-foreground">
          Últimas alterações de letra, cifra, tom e dados em todo o repertório. Para restaurar, abra
          o histórico da música.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-pessoa`}>Pessoa</Label>
          <select
            id={`${id}-pessoa`}
            value={actorId ?? ''}
            onChange={(e) => setFilter('pessoa', e.target.value)}
            className={selectClass}
          >
            <option value="">Todas</option>
            {filters.data?.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-musica`}>Música</Label>
          <select
            id={`${id}-musica`}
            value={songId ?? ''}
            onChange={(e) => setFilter('musica', e.target.value)}
            className={selectClass}
          >
            <option value="">Todas</option>
            {filters.data?.songs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activity.isPending ? (
        <LoadingState label="Carregando atividade…" />
      ) : activity.isError ? (
        <ErrorState onRetry={() => void activity.refetch()} />
      ) : activity.data.length === 0 ? (
        <EmptyState>Nenhuma alteração com esses filtros.</EmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {activity.data.map((item, index) => {
              const text = describeActivity(item);
              const body = (
                <>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium">
                      {item.songTitle ?? 'Música removida'}
                    </span>
                    <span className="text-sm">{text}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.actorName ?? 'sistema'} · {formatShortDate(item.occurredAt)} às{' '}
                      {formatTime(item.occurredAt)}
                    </span>
                  </span>
                  {item.songId && (
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  )}
                </>
              );
              return (
                <li key={`${item.occurredAt}-${index}`}>
                  {item.songId ? (
                    <Link
                      to={`/repertorio/${item.songId}/historico`}
                      className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {activity.data.length >= ACTIVITY_LIMIT && (
            <p className="text-sm text-muted-foreground">
              Mostrando as {ACTIVITY_LIMIT} alterações mais recentes. Use os filtros para ver
              outras.
            </p>
          )}
        </>
      )}
    </section>
  );
}
