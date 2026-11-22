import { BellRing, CalendarClock, Eye, Pencil, Pin, Trash2, Users } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormError } from '@/components/common/form-error';
import { LinkedText } from '@/components/common/linked-text';
import { ErrorState, LoadingState } from '@/components/common/states';
import { OverflowMenu, type OverflowMenuItem } from '@/components/layout/overflow-menu';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/features/auth';
import { formatDayLabel, formatTime } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import {
  useAnnouncement,
  useAudienceStatus,
  useDeleteAnnouncement,
  useMarkAnnouncementRead,
  useRemindAnnouncement,
  type AudienceStatus,
} from '../api';
import { scheduledLabel } from '../publish';
import { audienceSummary, seenLabel } from '../audience';

/** Detalhe do comunicado: texto completo, leitura registrada ao abrir e "Visto por" (admin). */
export function AnnouncementDetailPage() {
  const { announcementId = '' } = useParams();
  const navigate = useNavigate();
  const query = useAnnouncement(announcementId);
  const canManage = usePermission('announcements.manage');
  const remove = useDeleteAnnouncement();
  const markRead = useMarkAnnouncementRead();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Abrir o detalhe registra a leitura (uma vez por comunicado) e marca a notificação.
  const marked = useRef<string | null>(null);
  const item = query.data;
  useEffect(() => {
    if (!item || item.scheduled || marked.current === item.id) return;
    marked.current = item.id;
    markRead.mutate(item.id);
  }, [item, markRead]);

  if (query.isPending) {
    return (
      <>
        <ScreenHeader title="Comunicado" back="/comunicados" />
        <LoadingState label="Carregando comunicado…" />
      </>
    );
  }
  if (query.isError || !item) {
    return (
      <>
        <ScreenHeader title="Comunicado" back="/comunicados" />
        {query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <p className="mx-auto max-w-[45rem] rounded-2xl border bg-card p-4 text-sm">
            Comunicado não encontrado. Ele pode ter sido excluído ou não ser para você.
          </p>
        )}
      </>
    );
  }

  const menu: OverflowMenuItem[] = canManage
    ? [
        {
          label: 'Editar',
          icon: Pencil,
          onSelect: () => void navigate(`/comunicados/${item.id}/editar`),
        },
        {
          label: 'Excluir',
          icon: Trash2,
          destructive: true,
          onSelect: () => setConfirmDelete(true),
        },
      ]
    : [];

  return (
    <>
      <ScreenHeader
        title="Comunicado"
        back="/comunicados"
        actions={menu.length > 0 ? <OverflowMenu items={menu} /> : undefined}
      />
      <article
        aria-labelledby="comunicado-titulo"
        className="mx-auto flex max-w-[45rem] flex-col gap-4 rounded-2xl border bg-card p-5"
      >
        <header className="flex flex-col gap-2">
          <h2 id="comunicado-titulo" className="text-screen-title">
            {item.title}
          </h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
            {item.scheduled ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                <CalendarClock aria-hidden="true" className="size-3.5" />
                {scheduledLabel(item.publishedAt)}
              </span>
            ) : (
              <time dateTime={item.publishedAt}>
                {formatDayLabel(item.publishedAt)}, {formatTime(item.publishedAt)}
              </time>
            )}
            {item.author && <span>por {item.author}</span>}
            {item.pinned && (
              <span className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 font-semibold text-brand-text">
                <Pin aria-hidden="true" className="size-3.5" />
                Fixado no topo
              </span>
            )}
          </p>
          {canManage && (
            <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users aria-hidden="true" className="size-4" />
              Para: {audienceSummary(item.filter)}
            </p>
          )}
        </header>
        {item.body ? (
          <LinkedText text={item.body} className="text-[0.9375rem] leading-relaxed" />
        ) : (
          <p className="text-sm text-muted-foreground">Sem texto.</p>
        )}
      </article>

      {canManage && !item.scheduled && <SeenBy id={item.id} />}

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir este comunicado?"
        confirmLabel="Excluir"
        destructive
        busy={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          remove.mutate(item.id, {
            onSuccess: () => void navigate('/comunicados', { replace: true }),
            onSettled: () => setConfirmDelete(false),
          })
        }
      >
        Ele some para todos e as notificações dele também.
      </ConfirmDialog>
      {remove.isError && (
        <div className="mx-auto mt-3 max-w-[45rem]">
          <FormError error={remove.error} fallback="Não foi possível excluir." />
        </div>
      )}
    </>
  );
}

/** "Visto por N de M" → lista "Viram" | "Ainda não viram" e "Lembrar quem não viu". */
function SeenBy({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const status = useAudienceStatus(id, true);
  const remind = useRemindAnnouncement(id);
  const [tab, setTab] = useState<'viram' | 'nao'>('viram');
  const [notice, setNotice] = useState('');
  const panelId = useId();

  if (status.isPending) return null;
  if (status.isError) {
    return (
      <p className="mx-auto mt-3 max-w-[45rem] text-sm text-muted-foreground">
        Não foi possível carregar quem viu.
      </p>
    );
  }
  const seen = status.data.filter((r) => r.readAt);
  const unseen = status.data.filter((r) => !r.readAt);
  const list: AudienceStatus[] = tab === 'viram' ? seen : unseen;

  return (
    <section aria-label="Quem viu" className="mx-auto mt-4 flex max-w-[45rem] flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        className="self-start"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <Eye aria-hidden="true" />
        {seenLabel(seen.length, status.data.length)}
      </Button>
      {open && (
        <div id={panelId} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <div
            role="tablist"
            aria-label="Quem viu"
            className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
          >
            {(
              [
                ['viram', `Viram (${seen.length})`],
                ['nao', `Ainda não viram (${unseen.length})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={cn(
                  'min-h-11 rounded-lg px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  tab === value ? 'bg-card shadow-sm' : 'text-muted-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tab === 'viram' ? 'Ninguém abriu ainda.' : 'Todo mundo já viu.'}
            </p>
          ) : (
            <ul
              role="tabpanel"
              aria-label={tab === 'viram' ? 'Viram' : 'Ainda não viram'}
              className="flex flex-col divide-y"
            >
              {list.map((r) => (
                <li key={r.userId} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-medium">{r.name}</span>
                  {r.readAt && (
                    <span className="text-caption text-muted-foreground">
                      {formatDayLabel(r.readAt)}, {formatTime(r.readAt)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {unseen.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              className="self-start"
              disabled={remind.isPending}
              onClick={() =>
                remind.mutate(undefined, {
                  onSuccess: (n) =>
                    setNotice(
                      n === 1
                        ? 'Lembrete enviado para 1 pessoa.'
                        : `Lembrete enviado para ${n} pessoas.`,
                    ),
                })
              }
            >
              <BellRing aria-hidden="true" />
              {remind.isPending ? 'Enviando…' : 'Lembrar quem não viu'}
            </Button>
          )}
          <p role="status" aria-live="polite" className="text-sm font-medium text-brand-text">
            {notice}
          </p>
          {remind.isError && (
            <p role="alert" className="text-sm text-destructive">
              {friendlyError(remind.error)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
