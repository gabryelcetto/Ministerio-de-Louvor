import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, UserMinus } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormError } from '@/components/common/form-error';
import { ErrorState, LoadingState } from '@/components/common/states';
import { useUnsavedGuard } from '@/components/common/use-unsaved-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EVENT_TYPE_STYLES } from '@/features/agenda/event-type';
import { formatShortDate, formatTime } from '@/lib/dates';
import { usePermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { EventType } from '@/types/app.types';
import {
  addAssignments,
  assignmentsToInsert,
  createEvent,
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
    <section className="mx-auto flex max-w-3xl flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/escalas">
          <ArrowLeft aria-hidden="true" />
          Escalas
        </Link>
      </Button>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Montar escala</h1>
        <p className="text-sm text-muted-foreground">
          Cada pessoa incluída ou removida recebe uma notificação.
        </p>
      </header>

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
  );
}

function Builder({ data }: { data: SchedulingData }) {
  const canCreateEvent = usePermission('events.manage');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();

  const initialId = params.get('evento');
  const [mode, setMode] = useState<'existente' | 'novo'>(
    initialId || !canCreateEvent ? 'existente' : 'novo',
  );
  const [eventId, setEventId] = useState(
    initialId && data.events.some((e) => e.id === initialId)
      ? initialId
      : (data.events.find((e) => e.status === 'scheduled')?.id ?? ''),
  );
  const [draft, setDraft] = useState<EventDraft>(EMPTY_EVENT);
  const [rows, setRows] = useState<AssignmentDraft[]>(() => [emptyRow()]);
  const [showErrors, setShowErrors] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const targetId = mode === 'novo' ? createdId : eventId;
  const target = data.events.find((e) => e.id === targetId);
  const existing = target?.assignments ?? [];
  const eventErrors = mode === 'novo' && !createdId ? validateEventDraft(draft) : {};
  const problems = draftProblems(rows, existing);
  const pendingRows = assignmentsToInsert(targetId ?? 'novo', rows, existing);

  const dirty =
    !savedId &&
    (rows.some((r) => r.userId || r.functionId !== null) ||
      (mode === 'novo' && !createdId && Boolean(draft.title.trim() || draft.startsAt)));
  const guard = useUnsavedGuard(dirty);

  // Navega só depois que o formulário deixou de estar "sujo" (o guarda não bloqueia).
  useEffect(() => {
    if (savedId) void navigate(`/escalas/${savedId}`);
  }, [savedId, navigate]);

  const save = useMutation({
    mutationFn: async () => {
      let id = targetId;
      if (mode === 'novo' && !createdId) {
        id = await createEvent(draft);
        // Se a equipe falhar depois, o evento já existe: a próxima tentativa só grava a equipe.
        setCreatedId(id);
      }
      if (!id) throw new Error('Escolha o evento.');
      await addAssignments(assignmentsToInsert(id, rows, existing));
      return id;
    },
    onSettled: () => invalidateSchedules(client),
    onSuccess: (id) => setSavedId(id),
  });

  const submit = () => {
    setShowErrors(true);
    if (Object.keys(eventErrors).length > 0 || Object.keys(problems).length > 0) return;
    if (mode === 'existente' && !eventId) return;
    if (mode === 'existente' && pendingRows.length === 0) return;
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

        {canCreateEvent && !createdId && (
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
        ) : createdId ? (
          <p className="rounded-lg bg-muted p-3 text-sm">
            Evento <strong>{draft.title}</strong> criado. Falta salvar a equipe.
          </p>
        ) : (
          <NewEventFields
            draft={draft}
            onChange={setDraft}
            errors={showErrors ? eventErrors : {}}
          />
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

        <ul className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <li key={row.key}>
              <AssignmentRow
                index={index}
                row={row}
                data={data}
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

      {createdId && save.isError && (
        <p className="text-sm font-medium">O evento foi criado, mas a equipe não foi salva.</p>
      )}
      <FormError error={save.error} fallback="Não foi possível salvar a escala." />
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
            : mode === 'novo' && !createdId
              ? 'Criar evento e salvar escala'
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

function Field({
  label,
  error,
  children,
  id,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-erro`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function NewEventFields({
  draft,
  onChange,
  errors,
}: {
  draft: EventDraft;
  onChange: (draft: EventDraft) => void;
  errors: ReturnType<typeof validateEventDraft>;
}) {
  const base = useId();
  const set = (patch: Partial<EventDraft>) => onChange({ ...draft, ...patch });
  const aria = (field: keyof typeof errors) =>
    errors[field]
      ? { 'aria-invalid': true, 'aria-describedby': `${base}-${field}-erro` }
      : { 'aria-invalid': false };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Tipo" id={`${base}-type`}>
        <select
          id={`${base}-type`}
          value={draft.type}
          onChange={(e) => set({ type: e.target.value as EventType })}
          className={selectClass}
        >
          {(Object.keys(EVENT_TYPE_STYLES) as EventType[]).map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_STYLES[t].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Título" id={`${base}-title`} error={errors.title}>
        <Input
          id={`${base}-title`}
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Ex.: Culto de domingo"
          className="h-11 text-base"
          {...aria('title')}
        />
      </Field>
      <Field label="Início (horário de Brasília)" id={`${base}-startsAt`} error={errors.startsAt}>
        <Input
          id={`${base}-startsAt`}
          type="datetime-local"
          value={draft.startsAt}
          onChange={(e) => set({ startsAt: e.target.value })}
          className="h-11 text-base"
          {...aria('startsAt')}
        />
      </Field>
      <Field label="Término (opcional)" id={`${base}-endsAt`} error={errors.endsAt}>
        <Input
          id={`${base}-endsAt`}
          type="datetime-local"
          value={draft.endsAt}
          min={draft.startsAt || undefined}
          onChange={(e) => set({ endsAt: e.target.value })}
          className="h-11 text-base"
          {...aria('endsAt')}
        />
      </Field>
      <Field label="Local (opcional)" id={`${base}-location`}>
        <Input
          id={`${base}-location`}
          value={draft.location}
          onChange={(e) => set({ location: e.target.value })}
          className="h-11 text-base"
        />
      </Field>
      <Field label="Observações (opcional)" id={`${base}-notes`}>
        <Textarea
          id={`${base}-notes`}
          value={draft.notes}
          onChange={(e) => set({ notes: e.target.value })}
          rows={2}
          className="min-h-11"
        />
      </Field>
    </div>
  );
}

function AssignmentRow({
  index,
  row,
  data,
  problem,
  onChange,
  onRemove,
}: {
  index: number;
  row: AssignmentDraft;
  data: SchedulingData;
  problem?: string;
  onChange: (patch: Partial<AssignmentDraft>) => void;
  onRemove?: () => void;
}) {
  const base = useId();
  const member = data.members.find((m) => m.id === row.userId);
  const { own, others } = functionOptions(data.functions, member);
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
          {data.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
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
