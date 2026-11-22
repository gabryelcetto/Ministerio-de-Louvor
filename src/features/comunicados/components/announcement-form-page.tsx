import { Search, Send, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { FormError } from '@/components/common/form-error';
import { ErrorState, LoadingState } from '@/components/common/states';
import { useUnsavedGuard } from '@/components/common/use-unsaved-guard';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMyPermissions } from '@/features/auth';
import { initials } from '@/features/escalas';
import {
  buildMembers,
  matchesName,
  SECTION_FILTER_LABEL,
  useManagedFunctions,
  useMembers,
  type Section,
} from '@/features/integrantes';
import { useSingleFlight } from '@/hooks/use-single-flight';
import { formatDayLabel, formatShortDate, formatTime, isoToZonedLocal } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { publishChoice, submitLabel, type PublishMode } from '../publish';
import {
  useAnnouncement,
  useAudiencePreview,
  useSaveAnnouncement,
  useUpcomingEvents,
  type AnnouncementItem,
} from '../api';
import {
  addAll,
  AUDIENCE_TYPE_LABEL,
  audienceProblem,
  emptyFilter,
  PIN_LABEL,
  pinnedUntil,
  recipientsLabel,
  toggleId,
  type AudienceFilter,
  type AudienceType,
  type PinOption,
} from '../audience';

const TITLE_MAX = 120;
const BODY_MAX = 5000;

/** Novo comunicado (/comunicados/novo) e edição (/comunicados/:id/editar). */
export function AnnouncementFormPage() {
  const { announcementId } = useParams();
  const permissions = useMyPermissions();
  const canManage = permissions.data?.includes('announcements.manage') ?? false;
  const existing = useAnnouncement(announcementId ?? '');
  const editing = Boolean(announcementId);
  const title = editing ? 'Editar comunicado' : 'Novo comunicado';
  const back = editing ? `/comunicados/${announcementId}` : '/comunicados';

  if (permissions.isPending) {
    return (
      <>
        <ScreenHeader title={title} back={back} />
        <LoadingState />
      </>
    );
  }
  if (!canManage) {
    return (
      <>
        <ScreenHeader title={title} back={back} />
        <p className="mx-auto max-w-[45rem] rounded-2xl border bg-card p-4 text-sm">
          Você não tem permissão para publicar comunicados.
        </p>
      </>
    );
  }
  if (editing && existing.isPending) {
    return (
      <>
        <ScreenHeader title={title} back={back} />
        <LoadingState label="Carregando comunicado…" />
      </>
    );
  }
  if (editing && (existing.isError || !existing.data)) {
    return (
      <>
        <ScreenHeader title={title} back={back} />
        <ErrorState onRetry={() => void existing.refetch()} />
      </>
    );
  }
  return (
    <>
      <ScreenHeader title={title} back={back} />
      <AnnouncementForm key={announcementId ?? 'novo'} initial={existing.data ?? null} />
    </>
  );
}

function AnnouncementForm({ initial }: { initial: AnnouncementItem | null }) {
  const navigate = useNavigate();
  const id = useId();
  const save = useSaveAnnouncement();
  const once = useSingleFlight({ keepLockedOnSuccess: true });
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [filter, setFilter] = useState<AudienceFilter>(initial?.filter ?? { type: 'all' });
  const [pin, setPin] = useState<PinOption | 'keep'>(initial?.pinned ? 'keep' : 'none');
  const stage = !initial ? 'new' : initial.scheduled ? 'scheduled' : 'published';
  const [mode, setMode] = useState<PublishMode>(stage === 'scheduled' ? 'schedule' : 'now');
  const [publishLocal, setPublishLocal] = useState(
    initial?.scheduled ? isoToZonedLocal(initial.publishedAt) : '',
  );
  const choice = publishChoice(mode, publishLocal);
  const [tried, setTried] = useState(false);
  // Salvou: guarda o id e navega no efeito, depois que o aviso de "não salvo" foi desligado.
  const [savedId, setSavedId] = useState<string | null>(null);
  const saved = savedId !== null;

  const dirty =
    title !== (initial?.title ?? '') ||
    body !== (initial?.body ?? '') ||
    JSON.stringify(filter) !== JSON.stringify(initial?.filter ?? { type: 'all' });
  const guard = useUnsavedGuard(dirty && !saved);
  useEffect(() => {
    if (savedId) void navigate(`/comunicados/${savedId}`, { replace: true });
  }, [savedId, navigate]);

  const problem = audienceProblem(filter);
  const titleProblem = title.trim() ? null : 'Informe o título.';
  const preview = useAudiencePreview(filter, problem === null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (titleProblem || problem || choice.problem) return;
    void once(async () => {
      const newId = await save.mutateAsync({
        id: initial?.id ?? null,
        title: title.trim(),
        body: body.trim(),
        filter,
        pinnedUntil: pin === 'keep' ? (initial?.pinnedUntil ?? null) : pinnedUntil(pin),
        publishAt: choice.publishAt,
      });
      setSavedId(newId);
    }).catch(() => undefined); // o erro aparece pelo save.error
  };

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="mx-auto flex max-w-[45rem] flex-col gap-5 pb-28"
      aria-label={initial ? 'Editar comunicado' : 'Novo comunicado'}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-titulo`}>Título</Label>
        <Input
          id={`${id}-titulo`}
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={tried && !!titleProblem}
          aria-describedby={tried && titleProblem ? `${id}-titulo-erro` : undefined}
        />
        {tried && titleProblem && (
          <p id={`${id}-titulo-erro`} className="text-sm text-destructive">
            {titleProblem}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-texto`}>Texto</Label>
        <Textarea
          id={`${id}-texto`}
          value={body}
          rows={8}
          maxLength={BODY_MAX}
          onChange={(e) => setBody(e.target.value)}
          aria-describedby={`${id}-texto-dica`}
        />
        <p id={`${id}-texto-dica`} className="text-caption text-muted-foreground">
          Links (https://…) viram clicáveis. As quebras de linha são mantidas.
        </p>
      </div>

      <AudiencePicker filter={filter} onChange={setFilter} />
      {tried && problem && (
        <p role="alert" className="-mt-3 text-sm text-destructive">
          {problem}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-fixar`}>Fixar no topo</Label>
        <select
          id={`${id}-fixar`}
          value={pin}
          onChange={(e) => setPin(e.target.value as PinOption | 'keep')}
          className="h-11 rounded-lg border bg-card px-3 text-sm"
        >
          {initial?.pinned && initial.pinnedUntil && (
            <option value="keep">Manter fixado até {formatShortDate(initial.pinnedUntil)}</option>
          )}
          {(Object.keys(PIN_LABEL) as PinOption[]).map((option) => (
            <option key={option} value={option}>
              {PIN_LABEL[option]}
            </option>
          ))}
        </select>
      </div>

      {stage !== 'published' && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1.5 text-sm font-semibold">Quando publicar</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['now', 'Publicar agora'],
                ['schedule', 'Agendar'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium has-focus-visible:ring-2 has-focus-visible:ring-ring',
                  mode === value ? 'border-brand bg-brand-soft' : 'bg-card',
                )}
              >
                <input
                  type="radio"
                  name={`${id}-quando`}
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="size-4 accent-brand"
                />
                {label}
              </label>
            ))}
          </div>
          {mode === 'schedule' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-quando-data`}>Data e hora (horário de Brasília)</Label>
              <Input
                id={`${id}-quando-data`}
                type="datetime-local"
                value={publishLocal}
                onChange={(e) => setPublishLocal(e.target.value)}
                aria-invalid={tried && !!choice.problem}
                aria-describedby={`${id}-quando-dica`}
              />
              <p
                id={`${id}-quando-dica`}
                className={cn(
                  'text-caption',
                  tried && choice.problem ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {tried && choice.problem
                  ? choice.problem
                  : 'Os integrantes só veem e recebem o aviso na hora marcada.'}
              </p>
            </div>
          )}
        </fieldset>
      )}

      <FormError error={save.error} fallback="Não foi possível publicar." />

      <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 border-t bg-card px-4 py-3 md:bottom-0 md:left-60 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[45rem] items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="text-sm font-semibold">
            {problem
              ? 'Escolha para quem vai'
              : preview.isPending
                ? 'Contando…'
                : preview.isError
                  ? 'Não foi possível contar'
                  : recipientsLabel(preview.data)}
          </p>
          <Button type="submit" disabled={save.isPending || saved}>
            <Send aria-hidden="true" />
            {save.isPending ? 'Salvando…' : submitLabel(mode, stage)}
          </Button>
        </div>
      </div>
      {guard}
    </form>
  );
}

/** "Para quem": Todos, Grupos e funções, Escalados de um evento, Pessoas escolhidas. */
function AudiencePicker({
  filter,
  onChange,
}: {
  filter: AudienceFilter;
  onChange: (f: AudienceFilter) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <legend className="section-label px-1">Para quem</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(Object.keys(AUDIENCE_TYPE_LABEL) as AudienceType[]).map((type) => (
          <label
            key={type}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold',
              filter.type === type && 'border-brand bg-brand-soft text-brand-text',
            )}
          >
            <input
              type="radio"
              name={name}
              checked={filter.type === type}
              onChange={() => onChange(emptyFilter(type))}
              className="size-4 accent-[var(--primary)]"
            />
            {AUDIENCE_TYPE_LABEL[type]}
          </label>
        ))}
      </div>
      {filter.type === 'groups' && <GroupsPicker filter={filter} onChange={onChange} />}
      {filter.type === 'event' && <EventPicker filter={filter} onChange={onChange} />}
      {filter.type === 'users' && <PeoplePicker filter={filter} onChange={onChange} />}
    </fieldset>
  );
}

function GroupsPicker({
  filter,
  onChange,
}: {
  filter: Extract<AudienceFilter, { type: 'groups' }>;
  onChange: (f: AudienceFilter) => void;
}) {
  const functions = useManagedFunctions();
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 text-sm font-semibold">Grupos</legend>
        {(['vocal', 'instrumental'] as Section[]).map((section) => (
          <CheckChip
            key={section}
            label={SECTION_FILTER_LABEL[section]}
            checked={filter.sections.includes(section)}
            onChange={() => onChange({ ...filter, sections: toggleId(filter.sections, section) })}
          />
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 text-sm font-semibold">Funções</legend>
        {functions.isPending ? (
          <p className="text-sm text-muted-foreground">Carregando funções…</p>
        ) : functions.isError ? (
          <p className="text-sm text-destructive">Não foi possível carregar as funções.</p>
        ) : (
          functions.data
            .filter((f) => f.active)
            .map((f) => (
              <CheckChip
                key={f.id}
                label={f.name}
                checked={filter.function_ids.includes(f.id)}
                onChange={() =>
                  onChange({ ...filter, function_ids: toggleId(filter.function_ids, f.id) })
                }
              />
            ))
        )}
      </fieldset>
    </div>
  );
}

function CheckChip({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm',
        checked ? 'border-brand bg-brand-soft font-semibold text-brand-text' : 'bg-card',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}

function EventPicker({
  filter,
  onChange,
}: {
  filter: Extract<AudienceFilter, { type: 'event' }>;
  onChange: (f: AudienceFilter) => void;
}) {
  const id = useId();
  const events = useUpcomingEvents(true);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Evento</Label>
      <select
        id={id}
        value={filter.event_id}
        onChange={(e) => onChange({ type: 'event', event_id: e.target.value })}
        className="h-11 rounded-lg border bg-card px-3 text-sm"
      >
        <option value="">{events.isPending ? 'Carregando…' : 'Escolha…'}</option>
        {events.data?.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title} — {formatDayLabel(e.startsAt)}, {formatTime(e.startsAt)}
          </option>
        ))}
      </select>
      <p className="text-caption text-muted-foreground">Vai para quem está escalado nele.</p>
    </div>
  );
}

/** Busca com avatar e funções, chips removíveis e "Selecionar todos do resultado". */
function PeoplePicker({
  filter,
  onChange,
}: {
  filter: Extract<AudienceFilter, { type: 'users' }>;
  onChange: (f: AudienceFilter) => void;
}) {
  const id = useId();
  const { members, contacts } = useMembers();
  const [query, setQuery] = useState('');
  const all = useMemo(
    () =>
      members.data ? buildMembers(members.data, contacts.data ?? null).filter((m) => m.active) : [],
    [members.data, contacts.data],
  );
  const byId = useMemo(() => new Map(all.map((m) => [m.id, m])), [all]);
  const result = all.filter((m) => matchesName(m, query));
  const selected = filter.user_ids;
  const set = (ids: string[]) => onChange({ type: 'users', user_ids: ids });

  return (
    <div className="flex flex-col gap-3">
      {selected.length > 0 && (
        <ul aria-label="Pessoas escolhidas" className="flex flex-wrap gap-2">
          {selected.map((userId) => {
            const person = byId.get(userId);
            const personName = person?.name ?? 'Pessoa';
            return (
              <li key={userId}>
                <span className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-brand-soft py-1 pr-1 pl-3 text-sm font-semibold text-brand-text">
                  {personName}
                  <button
                    type="button"
                    onClick={() => set(selected.filter((x) => x !== userId))}
                    className="flex size-8 items-center justify-center rounded-md hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X aria-hidden="true" className="size-4" />
                    <span className="sr-only">Remover {personName}</span>
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>Buscar pessoa</Label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={id}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      {members.isPending ? (
        <p className="text-sm text-muted-foreground">Carregando integrantes…</p>
      ) : members.isError ? (
        <p className="text-sm text-destructive">Não foi possível carregar os integrantes.</p>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={result.length === 0}
            onClick={() =>
              set(
                addAll(
                  selected,
                  result.map((m) => m.id),
                ),
              )
            }
          >
            Selecionar todos do resultado ({result.length})
          </Button>
          <ul
            aria-label="Integrantes"
            className="flex max-h-80 flex-col divide-y overflow-y-auto rounded-xl border"
          >
            {result.length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground">
                Ninguém encontrado com esse nome.
              </li>
            ) : (
              result.map((m) => (
                <li key={m.id}>
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(m.id)}
                      onChange={() => set(toggleId(selected, m.id))}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-text"
                    >
                      {initials(m.name)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">{m.name}</span>
                      {m.functions.length > 0 && (
                        <span className="truncate text-caption text-muted-foreground">
                          {m.functions.join(', ')}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  );
}
