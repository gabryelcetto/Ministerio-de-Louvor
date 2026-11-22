import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarOff, Plus, Trash2, UserMinus } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormError } from '@/components/common/form-error';
import { ErrorState, LoadingState } from '@/components/common/states';
import { useUnsavedGuard } from '@/components/common/use-unsaved-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EVENT_TYPE_STYLES } from '@/features/agenda';
import { matchesSection, SECTION_FILTER_LABEL, type SectionFilter } from '@/features/integrantes';
import { dayKey, formatShortDate, formatTime, weeklyOccurrences } from '@/lib/dates';
import { usePermission } from '@/features/auth';
import { cn } from '@/lib/utils';
import {
  addAssignments,
  assignmentsToInsert,
  createEventWithTeam,
  draftProblems,
  functionOptions,
  invalidateSchedules,
  useRemoveAssignment,
  useSchedulingData,
  validateEventDraft,
  type AssignmentDraft,
  type EventDraft,
  type SchedulingData,
} from '../manage';
import { ScreenHeader } from '@/components/layout/screen-header';
import { useUnavailableOn } from '../presence-api';
import { EventFields } from './event-fields';

const selectClass =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

let rowCounter = 0;
const emptyRow = (): AssignmentDraft => ({
  key: `linha-${++rowCounter}`,
  userId: '',
  functionId: null,
  notes: '',
});

const EMPTY_EVENT: EventDraft = {
  type: 'culto',
  title: '',
  startsAt: '',
  endsAt: '',
  location: '',
  notes: '',
};

/** Montar escala: escolher (ou criar) o evento e incluir pessoas com a função de cada uma. */
export function ScheduleBuilderPage() {
  const canSchedule = usePermission('schedules.manage');
  const data = useSchedulingData();

  return (
    <>
      <ScreenHeader title="Montar escala" back="/escalas" />
      <section className="mx-auto flex max-w-[45rem] flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          Cada pessoa incluída ou removida recebe uma notificação.
        </p>

        {!canSchedule ? (
          <p role="alert" className="rounded-xl border p-4 text-sm">
            Você não tem permissão para montar escalas. Fale com a liderança.
          </p>
        ) : data.isPending ? (
          <LoadingState label="Carregando eventos e integrantes…" />
        ) : data.isError ? (
          <ErrorState onRetry={() => void data.refetch()} />
        ) : (
          <Builder data={data.data} />
        )}
      </section>
    </>
  );
}

function Builder({ data }: { data: SchedulingData }) {
  const canCreateEvent = usePermission('events.manage');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();

  const initialId = params.get('evento');
  const [mode, setMode] = useState<'existente' | 'novo'>(
    params.get('novo') === '1' && canCreateEvent
      ? 'novo'
      : initialId || !canCreateEvent
        ? 'existente'
        : 'novo',
  );
  const [eventId, setEventId] = useState(
    initialId && data.events.some((e) => e.id === initialId)
      ? initialId
      : (data.events.find((e) => e.status === 'scheduled')?.id ?? ''),
  );
  const [draft, setDraft] = useState<EventDraft>(EMPTY_EVENT);
  const [rows, setRows] = useState<AssignmentDraft[]>(() => [emptyRow()]);
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('todos');
  const [showErrors, setShowErrors] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [weeks, setWeeks] = useState(4);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [confirmUnavailable, setConfirmUnavailable] = useState(false);

  const targetId = mode === 'novo' ? null : eventId;
  const target = data.events.find((e) => e.id === targetId);
  const existing = target?.assignments ?? [];
  const eventErrors = mode === 'novo' ? validateEventDraft(draft) : {};
  const problems = draftProblems(rows, existing);
  const pendingRows = assignmentsToInsert(targetId ?? 'novo', rows, existing);
  // Indisponibilidades do dia do evento (Fase H): alerta e confirmação antes de escalar.
  const day =
    mode === 'novo' ? draft.startsAt.slice(0, 10) || null : target ? dayKey(target.startsAt) : null;
  const unavailableQuery = useUnavailableOn(day);
  const unavailable = new Map(
    (unavailableQuery.data ?? []).map((u) => [u.user_id, u.note] as const),
  );
  const unavailableNames = [
    ...new Set(
      rows
        .filter((r) => r.userId && unavailable.has(r.userId))
        .map((r) => data.members.find((m) => m.id === r.userId)?.name ?? 'Integrante'),
    ),
  ];

  const dirty =
    !savedId &&
    (rows.some((r) => r.userId || r.functionId !== null) ||
      (mode === 'novo' && Boolean(draft.title.trim() || draft.startsAt)));
  const guard = useUnsavedGuard(dirty);

  // Navega só depois que o formulário deixou de estar "sujo" (o guarda não bloqueia).
  // Passo 3: repertório (menos na repetição semanal, que nasce sem repertório).
  useEffect(() => {
    if (!savedId) return;
    void navigate(
      mode === 'novo' && repeat ? `/escalas/${savedId}` : `/escalas/${savedId}/repertorio?montar=1`,
    );
  }, [savedId, navigate, mode, repeat]);

  const save = useMutation({
    mutationFn: async () => {
      if (mode === 'novo') {
        // Evento (ou um por semana) + equipe numa gravação só: nada fica pela metade.
        const team = assignmentsToInsert('novo', rows, []).map(
          ({ user_id, function_id, notes }) => ({ user_id, function_id, notes }),
        );
        const ids = await createEventWithTeam(draft, team, repeat ? weeks : 1);
        return ids[0]!;
      }
      if (!eventId) throw new Error('Escolha o evento.');
      await addAssignments(assignmentsToInsert(eventId, rows, existing));
      return eventId;
    },
    onSettled: () => invalidateSchedules(client),
    onSuccess: (id) => setSavedId(id),
  });

  const submit = () => {
    setShowErrors(true);
    if (Object.keys(eventErrors).length > 0 || Object.keys(problems).length > 0) return;
    if (mode === 'existente' && !eventId) return;
    if (mode === 'existente' && pendingRows.length === 0) return;
    if (unavailableNames.length > 0) {
      setConfirmUnavailable(true);
      return;
    }
    save.mutate();
  };

  const updateRow = (key: string, patch: Partial<AssignmentDraft>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <fieldset className="flex flex-col gap-4 rounded-xl border p-4">
        <legend className="px-1 text-lg font-semibold">1. Evento</legend>

        {canCreateEvent && (
          <div role="radiogroup" aria-label="Evento" className="grid grid-cols-2 gap-2">
            {(
              [
                ['existente', 'Evento da agenda'],
                ['novo', 'Novo evento'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                  mode === value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                )}
              >
                <input
                  type="radio"
                  name="modo-evento"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        )}

        {mode === 'existente' ? (
          <ExistingEventPicker
            data={data}
            value={eventId}
            onChange={setEventId}
            showError={showErrors}
          />
        ) : (
          <>
            <EventFields draft={draft} onChange={setDraft} errors={showErrors ? eventErrors : {}} />
            <RepeatWeekly
              checked={repeat}
              weeks={weeks}
              startsAt={draft.startsAt}
              onCheckedChange={setRepeat}
              onWeeksChange={setWeeks}
            />
          </>
        )}
        {!canCreateEvent && (
          <p className="text-xs text-muted-foreground">
            Para criar um evento novo é preciso a permissão de gerenciar eventos.
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-xl border p-4">
        <legend className="px-1 text-lg font-semibold">2. Equipe</legend>

        {existing.length > 0 && <CurrentTeam data={data} assignments={existing} />}

        <div role="radiogroup" aria-label="Mostrar" className="flex flex-wrap gap-2">
          {(Object.keys(SECTION_FILTER_LABEL) as SectionFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={sectionFilter === value}
              onClick={() => setSectionFilter(value)}
              className={cn(
                'min-h-10 rounded-full border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                sectionFilter === value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
              )}
            >
              {SECTION_FILTER_LABEL[value]}
            </button>
          ))}
        </div>

        <ul className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <li key={row.key}>
              <AssignmentRow
                index={index}
                row={row}
                data={data}
                filter={sectionFilter}
                unavailable={unavailable}
                problem={showErrors ? problems[row.key] : undefined}
                onChange={(patch) => updateRow(row.key, patch)}
                onRemove={
                  rows.length > 1
                    ? () => setRows((list) => list.filter((r) => r.key !== row.key))
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setRows((list) => [...list, emptyRow()])}
        >
          <Plus aria-hidden="true" />
          Adicionar pessoa
        </Button>
      </fieldset>

      <FormError error={save.error} fallback="Não foi possível salvar a escala." />
      <ConfirmDialog
        open={confirmUnavailable}
        title="Escalar mesmo assim?"
        confirmLabel="Escalar mesmo assim"
        cancelLabel="Voltar"
        onConfirm={() => {
          setConfirmUnavailable(false);
          save.mutate();
        }}
        onCancel={() => setConfirmUnavailable(false)}
      >
        {unavailableNames.join(', ')} {unavailableNames.length === 1 ? 'marcou' : 'marcaram'} que
        não pode nesse dia.
      </ConfirmDialog>
      {showErrors && mode === 'existente' && eventId && pendingRows.length === 0 && (
        <p role="alert" className="text-sm text-destructive">
          Inclua pelo menos uma pessoa com a função.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline">
          <Link to="/escalas">Cancelar</Link>
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending
            ? 'Salvando…'
            : mode === 'novo'
              ? repeat
                ? `Criar ${weeks} eventos`
                : pendingRows.length > 0
                  ? 'Criar evento e salvar escala'
                  : 'Criar evento'
              : 'Salvar escala'}
        </Button>
      </div>
      {guard}
    </form>
  );
}

function ExistingEventPicker({
  data,
  value,
  onChange,
  showError,
}: {
  data: SchedulingData;
  value: string;
  onChange: (id: string) => void;
  showError: boolean;
}) {
  const id = useId();
  if (data.events.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum evento futuro na agenda.</p>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Evento</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={showError && !value}
        className={selectClass}
      >
        <option value="">Escolha…</option>
        {data.events.map((e) => (
          <option key={e.id} value={e.id}>
            {formatShortDate(e.startsAt)} {formatTime(e.startsAt)} —{' '}
            {EVENT_TYPE_STYLES[e.type].label}: {e.title}
            {e.status === 'cancelled' ? ' (cancelado)' : ''}
          </option>
        ))}
      </select>
      {showError && !value && <p className="text-sm text-destructive">Escolha o evento.</p>}
    </div>
  );
}

function AssignmentRow({
  index,
  row,
  data,
  filter,
  unavailable,
  problem,
  onChange,
  onRemove,
}: {
  index: number;
  row: AssignmentDraft;
  data: SchedulingData;
  filter: SectionFilter;
  /** Quem marcou indisponibilidade no dia do evento (com o motivo). */
  unavailable: Map<string, string | null>;
  problem?: string;
  onChange: (patch: Partial<AssignmentDraft>) => void;
  onRemove?: () => void;
}) {
  const base = useId();
  const member = data.members.find((m) => m.id === row.userId);
  // Filtro Cantores/Instrumentistas: só reduz as opções (quem já foi escolhido continua).
  const people = data.members.filter(
    (m) => m.id === row.userId || matchesSection(m.functionIds, data.functions, filter),
  );
  const shownFunctions = data.functions.filter(
    (f) => filter === 'todos' || f.section === filter || f.id === row.functionId,
  );
  const { own, others } = functionOptions(shownFunctions, member);
  const errorId = `${base}-erro`;

  return (
    <div
      role="group"
      aria-label={`Pessoa ${index + 1}`}
      className={cn(
        'grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]',
        problem && 'border-destructive',
      )}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${base}-pessoa`}>Pessoa</Label>
        <select
          id={`${base}-pessoa`}
          value={row.userId}
          aria-describedby={problem ? errorId : undefined}
          onChange={(e) => {
            const next = data.members.find((m) => m.id === e.target.value);
            // Sugere a função quando a pessoa tem uma só.
            const only = next?.functionIds.length === 1 ? next.functionIds[0]! : row.functionId;
            onChange({ userId: e.target.value, functionId: only ?? null });
          }}
          className={selectClass}
        >
          <option value="">Escolha…</option>
          {people.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {unavailable.has(m.id) ? ' (indisponível)' : ''}
            </option>
          ))}
        </select>
        {row.userId && unavailable.has(row.userId) && (
          <p role="status" className="flex items-start gap-1 text-caption text-destructive">
            <CalendarOff aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            Marcou que não pode nesse dia
            {unavailable.get(row.userId) ? `: ${unavailable.get(row.userId)}` : '.'}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${base}-funcao`}>Função</Label>
        <select
          id={`${base}-funcao`}
          value={row.functionId ?? ''}
          aria-describedby={problem ? errorId : undefined}
          onChange={(e) => onChange({ functionId: e.target.value ? Number(e.target.value) : null })}
          className={selectClass}
        >
          <option value="">Escolha…</option>
          {own.length > 0 && (
            <optgroup label={`Funções de ${member?.name ?? 'quem foi escolhido'}`}>
              {own.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label={own.length > 0 ? 'Outras funções' : 'Funções'}>
            {others.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <div className="flex items-end">
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={onRemove}
            aria-label={`Tirar a linha ${index + 1}`}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-3">
        <Label htmlFor={`${base}-obs`}>Observação (opcional)</Label>
        <Input
          id={`${base}-obs`}
          value={row.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Ex.: segunda voz"
          className="h-11 text-base"
        />
      </div>
      {problem && (
        <p id={errorId} className="text-sm text-destructive sm:col-span-3">
          {problem}
        </p>
      )}
    </div>
  );
}

function CurrentTeam({
  data,
  assignments,
}: {
  data: SchedulingData;
  assignments: SchedulingData['events'][number]['assignments'];
}) {
  const remove = useRemoveAssignment();
  const [pending, setPending] = useState<(typeof assignments)[number] | null>(null);
  const nameOf = (id: string) => data.members.find((m) => m.id === id)?.name ?? 'Integrante';
  const fnOf = (id: number) => data.functions.find((f) => f.id === id)?.name ?? 'Função';

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted-foreground">Já na escala</h3>
      <ul className="flex flex-col gap-1">
        {assignments.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
          >
            <span>
              <strong>{nameOf(a.userId)}</strong> — {fnOf(a.functionId)}
              {a.notes ? ` (${a.notes})` : ''}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                remove.reset();
                setPending(a);
              }}
              aria-label={`Remover ${nameOf(a.userId)} (${fnOf(a.functionId)})`}
            >
              <UserMinus aria-hidden="true" />
              Remover
            </Button>
          </li>
        ))}
      </ul>
      <FormError error={remove.error} fallback="Não foi possível remover." />
      <ConfirmDialog
        open={pending !== null}
        title="Remover da escala?"
        confirmLabel="Remover"
        destructive
        busy={remove.isPending}
        onConfirm={() =>
          pending &&
          remove.mutate(pending.id, {
            onSettled: () => setPending(null),
          })
        }
        onCancel={() => setPending(null)}
      >
        {pending && (
          <>
            {nameOf(pending.userId)} sai da função {fnOf(pending.functionId)} e recebe uma
            notificação.
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}

/** "Repetir toda semana por N semanas" (1 a 12): mesma equipe, sem repertório. */
function RepeatWeekly({
  checked,
  weeks,
  startsAt,
  onCheckedChange,
  onWeeksChange,
}: {
  checked: boolean;
  weeks: number;
  startsAt: string;
  onCheckedChange: (value: boolean) => void;
  onWeeksChange: (value: number) => void;
}) {
  const id = useId();
  const dates = checked ? weeklyOccurrences(startsAt, weeks) : [];
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-chip p-3">
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        Repetir toda semana
      </label>
      {checked && (
        <>
          <div className="flex items-center gap-2">
            <Label htmlFor={id}>Por quantas semanas</Label>
            <select
              id={id}
              value={weeks}
              onChange={(e) => onWeeksChange(Number(e.target.value))}
              className="h-11 rounded-md border border-input bg-background px-3 text-base"
            >
              {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n} semanas
                </option>
              ))}
            </select>
          </div>
          <p className="text-caption text-muted-foreground">
            {dates.length > 0
              ? `Cria ${dates.length} eventos: ${dates.map((d) => formatShortDate(d)).join(', ')}. Mesma equipe, sem repertório.`
              : 'Escolha a data de início para ver as datas.'}
          </p>
        </>
      )}
    </div>
  );
}
