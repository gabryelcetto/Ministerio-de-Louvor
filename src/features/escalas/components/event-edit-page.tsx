import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { FormError } from '@/components/common/form-error';
import { ErrorState, LoadingState } from '@/components/common/states';
import { useUnsavedGuard } from '@/components/common/use-unsaved-guard';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Button } from '@/components/ui/button';
import { useMyPermissions } from '@/features/auth';
import { useSingleFlight } from '@/hooks/use-single-flight';
import { isoToZonedLocal } from '@/lib/dates';
import type { EventDetail } from '../api';
import { useEventDetail } from '../hooks';
import { useUpdateEvent, validateEventDraft, type EventDraft } from '../manage';
import { EventFields } from './event-fields';

/** Editar evento (events.manage): tipo, título, data, início, fim, local e observações. */
export function EventEditPage() {
  const { eventId = '' } = useParams();
  const query = useEventDetail(eventId);
  const permissions = useMyPermissions();
  const back = `/escalas/${eventId}`;

  if (query.isPending || permissions.isPending) {
    return (
      <>
        <ScreenHeader title="Editar evento" back={back} />
        <LoadingState label="Carregando evento…" />
      </>
    );
  }
  if (!permissions.data?.includes('events.manage')) {
    return (
      <>
        <ScreenHeader title="Editar evento" back={back} />
        <p role="alert" className="mx-auto max-w-[45rem] rounded-2xl border bg-card p-4 text-sm">
          Você não tem permissão para editar eventos.
        </p>
      </>
    );
  }
  if (query.isError || !query.data) {
    return (
      <>
        <ScreenHeader title="Editar evento" back={back} />
        <ErrorState onRetry={() => void query.refetch()} />
      </>
    );
  }
  return (
    <>
      <ScreenHeader title="Editar evento" subtitle={query.data.event.title} back={back} />
      <EditForm detail={query.data} />
    </>
  );
}

function toDraft(detail: EventDetail): EventDraft {
  const { event } = detail;
  return {
    type: event.type,
    title: event.title,
    startsAt: isoToZonedLocal(event.starts_at),
    endsAt: event.ends_at ? isoToZonedLocal(event.ends_at) : '',
    location: event.location ?? '',
    notes: event.notes ?? '',
  };
}

function EditForm({ detail }: { detail: EventDetail }) {
  const navigate = useNavigate();
  const initial = toDraft(detail);
  const [draft, setDraft] = useState<EventDraft>(initial);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = useUpdateEvent(detail.event.id);
  const once = useSingleFlight({ keepLockedOnSuccess: true });
  const errors = validateEventDraft(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const guard = useUnsavedGuard(dirty && !saved);

  useEffect(() => {
    if (saved) void navigate(`/escalas/${detail.event.id}`, { replace: true });
  }, [saved, navigate, detail.event.id]);

  return (
    <form
      noValidate
      aria-label="Editar evento"
      className="mx-auto flex max-w-[45rem] flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (Object.keys(errors).length > 0) return;
        void once(async () => {
          await save.mutateAsync(draft);
          setSaved(true);
        }).catch(() => undefined); // o erro aparece pelo save.error
      }}
    >
      <div className="rounded-2xl border bg-card p-4">
        <EventFields draft={draft} onChange={setDraft} errors={tried ? errors : {}} />
      </div>
      <p className="text-caption text-muted-foreground">
        Quem está escalado recebe um aviso se mudar a data, o horário, o local ou o título.
      </p>
      <FormError error={save.error} fallback="Não foi possível salvar o evento." />
      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link to={`/escalas/${detail.event.id}`}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={save.isPending || saved}>
          {save.isPending ? 'Salvando…' : 'Salvar evento'}
        </Button>
      </div>
      {guard}
    </form>
  );
}
