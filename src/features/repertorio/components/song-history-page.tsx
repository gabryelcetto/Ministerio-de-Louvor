import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormError } from '@/components/common/form-error';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { formatShortDate, formatTime } from '@/lib/dates';
import { usePermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { VersionField } from '@/types/database.types';
import { useSong } from '../api';
import { useRestoreVersion, useSongVersions, VERSIONS_LIMIT, type SongVersion } from '../editing';
import {
  CHANGE_LABEL,
  changedMetadata,
  FIELD_LABEL,
  parseMetadata,
  summarizeChange,
} from '../history-format';

type Filter = VersionField | 'todos';
const FILTERS: Filter[] = ['todos', 'chords', 'lyrics', 'official_key', 'metadata'];

/** Histórico da música: quem mudou o quê e quando; "Restaurar" só com history.restore. */
export function SongHistoryPage() {
  const { songId = '' } = useParams();
  const song = useSong(songId);
  const versions = useSongVersions(songId);
  const restore = useRestoreVersion(songId);
  const canRestore = usePermission('history.restore');
  const [filter, setFilter] = useState<Filter>('todos');
  const [pending, setPending] = useState<SongVersion | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const items =
    filter === 'todos' ? versions.data : versions.data?.filter((v) => v.field === filter);

  const confirmRestore = () => {
    if (!pending) return;
    const label = FIELD_LABEL[pending.field].toLowerCase();
    restore.mutate(pending.id, {
      onSuccess: () => {
        setNotice(
          `Versão restaurada: ${label}. A restauração entrou no histórico como nova versão.`,
        );
        setPending(null);
      },
      // Fecha o diálogo e mostra o erro na página.
      onError: () => setPending(null),
    });
  };

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to={`/repertorio/${songId}`}>
          <ArrowLeft aria-hidden="true" />
          {song.data?.title ?? 'Música'}
        </Link>
      </Button>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Histórico</h1>
        <p className="text-sm text-muted-foreground">
          Toda alteração de letra, cifra, tom oficial e dados fica registrada.
          {canRestore
            ? ' Restaurar volta ao conteúdo daquela versão e também fica registrado.'
            : ' Só a liderança pode restaurar versões.'}
        </p>
      </header>

      <p role="status" aria-live="polite" className="text-sm font-medium text-primary">
        {notice}
      </p>
      <FormError error={restore.error} fallback="Não foi possível restaurar a versão." />

      <div role="group" aria-label="Filtrar por campo" className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
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
            {value === 'todos' ? 'Tudo' : FIELD_LABEL[value]}
          </button>
        ))}
      </div>

      {versions.isPending ? (
        <LoadingState label="Carregando histórico…" />
      ) : versions.isError ? (
        <ErrorState onRetry={() => void versions.refetch()} />
      ) : !items || items.length === 0 ? (
        <EmptyState>
          Nenhuma alteração registrada{filter === 'todos' ? '' : ' neste campo'}.
        </EmptyState>
      ) : (
        <>
          <ol className="flex flex-col gap-3">
            {items.map((v) => (
              <li key={v.id}>
                <VersionCard
                  version={v}
                  canRestore={canRestore}
                  busy={restore.isPending}
                  onRestore={() => {
                    setNotice(null);
                    restore.reset();
                    setPending(v);
                  }}
                />
              </li>
            ))}
          </ol>
          {versions.data.length >= VERSIONS_LIMIT && (
            <p className="text-center text-sm text-muted-foreground">
              Mostrando as {VERSIONS_LIMIT} alterações mais recentes.
            </p>
          )}
        </>
      )}

      <ConfirmDialog
        open={pending !== null}
        title="Restaurar esta versão?"
        confirmLabel="Restaurar"
        busy={restore.isPending}
        onConfirm={confirmRestore}
        onCancel={() => setPending(null)}
      >
        {pending && (
          <>
            {FIELD_LABEL[pending.field]} volta ao conteúdo de {formatShortDate(pending.changedAt)}{' '}
            às {formatTime(pending.changedAt)}
            {pending.author ? `, salvo por ${pending.author}` : ''}. O conteúdo atual não se perde:
            ele continua no histórico.
          </>
        )}
      </ConfirmDialog>
    </section>
  );
}

function VersionCard({
  version: v,
  canRestore,
  busy,
  onRestore,
}: {
  version: SongVersion;
  canRestore: boolean;
  busy: boolean;
  onRestore: () => void;
}) {
  const isText = v.field === 'lyrics' || v.field === 'chords';
  return (
    <article className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
          {FIELD_LABEL[v.field]}
        </span>
        <span className="font-medium">{CHANGE_LABEL[v.changeType]}</span>
        {v.isCurrent && (
          <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            versão atual
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        <time dateTime={v.changedAt}>
          {formatShortDate(v.changedAt)} às {formatTime(v.changedAt)}
        </time>{' '}
        · {v.author ?? 'sistema'}
      </p>
      <p className="text-sm">{summarizeChange(v.field, v.oldValue, v.newValue)}</p>

      {v.field === 'metadata' && v.oldValue !== null && (
        <MetadataDiff oldValue={v.oldValue} newValue={v.newValue} />
      )}

      {isText && (
        <div className="flex flex-col gap-1">
          {v.changeType !== 'create' && <ValueDetails label="Valor anterior" value={v.oldValue} />}
          <ValueDetails label="Conteúdo desta versão" value={v.newValue} />
        </div>
      )}
      {v.field === 'metadata' && v.oldValue === null && (
        <ValueDetails label="Dados cadastrados" value={v.newValue} metadata />
      )}

      {canRestore && !v.isCurrent && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={onRestore}
          disabled={busy}
        >
          <RotateCcw aria-hidden="true" />
          Restaurar
        </Button>
      )}
    </article>
  );
}

function MetadataDiff({ oldValue, newValue }: { oldValue: string; newValue: string | null }) {
  const changes = changedMetadata(oldValue, newValue);
  if (changes.length === 0) return null;
  return (
    <dl className="grid gap-1 rounded-lg bg-muted p-3 text-sm">
      {changes.map((c) => (
        <div key={c.label} className="flex flex-wrap gap-x-2">
          <dt className="font-medium">{c.label}:</dt>
          <dd>
            <span className="sr-only">valor anterior </span>
            <span className="text-muted-foreground line-through">{c.before}</span>{' '}
            <span aria-hidden="true">→</span>
            <span className="sr-only">, novo valor </span> {c.after}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ValueDetails({
  label,
  value,
  metadata = false,
}: {
  label: string;
  value: string | null;
  metadata?: boolean;
}) {
  const entries = metadata ? parseMetadata(value) : null;
  return (
    <details className="rounded-lg border px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {label}
      </summary>
      {entries ? (
        <dl className="mt-2 grid gap-1">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="text-muted-foreground">{k}:</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : value?.trim() ? (
        <pre className="mt-2 max-h-80 overflow-auto font-mono text-xs whitespace-pre-wrap">
          {value}
        </pre>
      ) : (
        <p className="mt-2 text-muted-foreground">(vazio)</p>
      )}
    </details>
  );
}
