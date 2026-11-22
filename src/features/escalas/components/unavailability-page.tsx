import { CalendarOff, Trash2 } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { FormError } from '@/components/common/form-error';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/features/auth';
import { useSingleFlight } from '@/hooks/use-single-flight';
import { dayKey } from '@/lib/dates';
import { UNAVAILABILITY_NOTE_MAX, formatPeriod, periodError, upcomingPeriods } from '../presence';
import {
  useAddUnavailability,
  useDeleteUnavailability,
  useMyUnavailability,
} from '../presence-api';

/** Mais → "Minhas indisponibilidades": dias em que a pessoa não pode ser escalada. */
export function UnavailabilityPage() {
  const { session } = useSession();
  const query = useMyUnavailability(session?.user.id);
  const remove = useDeleteUnavailability();
  const run = useSingleFlight();
  const today = dayKey(new Date());

  return (
    <section className="mx-auto flex w-full max-w-[45rem] flex-col gap-5">
      <ScreenHeader title="Minhas indisponibilidades" back="/mais" />
      <p className="text-sm text-muted-foreground">
        Avise os dias em que você não pode servir. Quem monta a escala vê um alerta antes de escalar
        você nesses dias.
      </p>

      <UnavailabilityForm today={today} />

      <section aria-labelledby="periodos-titulo" className="flex flex-col gap-2">
        <h2 id="periodos-titulo" className="section-label">
          Próximos períodos
        </h2>
        {query.isPending ? (
          <LoadingState label="Carregando…" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : upcomingPeriods(query.data, today).length === 0 ? (
          <EmptyState>Nenhum período cadastrado.</EmptyState>
        ) : (
          <ul aria-label="Períodos" className="flex flex-col gap-2">
            {upcomingPeriods(query.data, today).map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <CalendarOff aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                <span className="flex flex-1 flex-col">
                  <span className="font-semibold">{formatPeriod(p)}</span>
                  {p.note && <span className="text-sm text-muted-foreground">{p.note}</span>}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={remove.isPending}
                  onClick={() => run(() => remove.mutateAsync(p.id)).catch(() => {})}
                >
                  <Trash2 aria-hidden="true" />
                  <span className="sr-only">Apagar {formatPeriod(p)}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
        <FormError error={remove.error} />
      </section>
    </section>
  );
}

function UnavailabilityForm({ today }: { today: string }) {
  const add = useAddUnavailability();
  const run = useSingleFlight();
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const ids = { start: useId(), end: useId(), note: useId() };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const end = endsOn || startsOn;
    const problem = periodError(startsOn, end);
    setError(problem ?? '');
    setSaved(false);
    if (problem) return;
    void run(() => add.mutateAsync({ startsOn, endsOn: end, note }))
      .then(() => {
        setStartsOn('');
        setEndsOn('');
        setNote('');
        setSaved(true);
      })
      .catch(() => {});
  };

  return (
    <form
      aria-label="Adicionar indisponibilidade"
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={ids.start}>Primeiro dia</Label>
          <Input
            id={ids.start}
            type="date"
            min={today}
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={ids.end}>Último dia</Label>
          <Input
            id={ids.end}
            type="date"
            min={startsOn || today}
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
          />
        </div>
      </div>
      <p className="text-caption text-muted-foreground">Só um dia? Deixe o último dia em branco.</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={ids.note}>Motivo (opcional)</Label>
        <Input
          id={ids.note}
          value={note}
          maxLength={UNAVAILABILITY_NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <FormError error={add.error} />
      {saved && (
        <p role="status" className="text-sm text-muted-foreground">
          Período salvo.
        </p>
      )}
      <Button type="submit" className="self-start" disabled={add.isPending}>
        {add.isPending ? 'Salvando…' : 'Adicionar'}
      </Button>
    </form>
  );
}
