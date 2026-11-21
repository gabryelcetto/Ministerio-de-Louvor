import { useId, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EVENT_TYPE_STYLES } from '@/features/agenda';
import type { EventType } from '@/types/app.types';
import { type EventDraft, type validateEventDraft } from '../manage';

export const selectClass =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Campos do evento (tipo, título, início, término, local, observações): criar e editar. */
export function Field({
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

export function EventFields({
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
