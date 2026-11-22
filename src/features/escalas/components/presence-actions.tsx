import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useId, useState } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormError } from '@/components/common/form-error';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSingleFlight } from '@/hooks/use-single-flight';
import { cn } from '@/lib/utils';
import type { AssignmentResponse } from '@/types/app.types';
import { NOTE_MAX, RESPONSE_LABEL, canRespond } from '../presence';
import { useRespond, useSubstitutes } from '../presence-api';

/** Ícone + texto da resposta (não depende só de cor). */
export function ResponseBadge({
  response,
  className,
}: {
  response: AssignmentResponse;
  className?: string;
}) {
  const Icon = response === 'confirmed' ? CheckCircle2 : response === 'declined' ? XCircle : Clock;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-caption font-semibold',
        response === 'confirmed' && 'text-brand-text',
        response === 'declined' && 'text-destructive',
        response === 'pending' && 'text-muted-foreground',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {RESPONSE_LABEL[response]}
    </span>
  );
}

/**
 * "Confirmo" / "Não posso" da pessoa escalada (Início, Escalas e detalhe do evento).
 * "Não posso" pede o motivo (opcional) e deixa sugerir um substituto.
 */
export function PresenceActions({
  assignmentIds,
  startsAt,
  response,
  eventTitle,
  showStatus = true,
}: {
  assignmentIds: string[];
  startsAt: string;
  response: AssignmentResponse;
  eventTitle: string;
  /** Mostra "Aguardando resposta" ao lado dos botões (a lista já mostra no cartão). */
  showStatus?: boolean;
}) {
  const respond = useRespond();
  const run = useSingleFlight();
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [suggested, setSuggested] = useState('');
  const noteId = useId();
  const suggestId = useId();
  const substitutes = useSubstitutes(declining ? (assignmentIds[0] ?? null) : null);

  if (!canRespond(startsAt) || assignmentIds.length === 0) {
    return <ResponseBadge response={response} />;
  }

  const confirm = () =>
    run(() => respond.mutateAsync({ assignmentIds, response: 'confirmed' })).catch(() => {});
  const decline = () =>
    run(() =>
      respond.mutateAsync({
        assignmentIds,
        response: 'declined',
        note,
        suggestedUserId: suggested || null,
      }),
    )
      .then(() => setDeclining(false))
      .catch(() => {});

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={`Sua presença em ${eventTitle}`}
        className="flex flex-wrap items-center gap-2"
      >
        <Button
          type="button"
          size="sm"
          variant={response === 'confirmed' ? 'default' : 'outline'}
          aria-pressed={response === 'confirmed'}
          disabled={respond.isPending}
          onClick={confirm}
        >
          <CheckCircle2 aria-hidden="true" />
          Confirmo
        </Button>
        <Button
          type="button"
          size="sm"
          variant={response === 'declined' ? 'destructive' : 'outline'}
          aria-pressed={response === 'declined'}
          disabled={respond.isPending}
          onClick={() => {
            respond.reset();
            setDeclining(true);
          }}
        >
          <XCircle aria-hidden="true" />
          Não posso
        </Button>
        {showStatus && response === 'pending' && <ResponseBadge response="pending" />}
      </div>
      {!declining && <FormError error={respond.error} />}

      <ConfirmDialog
        open={declining}
        title="Não vai poder?"
        confirmLabel="Avisar que não posso"
        cancelLabel="Voltar"
        destructive
        busy={respond.isPending}
        onConfirm={decline}
        onCancel={() => setDeclining(false)}
      >
        <div className="flex flex-col gap-3 text-foreground">
          <p className="text-muted-foreground">Quem monta a escala vai receber um aviso.</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={noteId}>Motivo (opcional)</Label>
            <Textarea
              id={noteId}
              value={note}
              maxLength={NOTE_MAX}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={suggestId}>Sugerir substituto (opcional)</Label>
            <select
              id={suggestId}
              value={suggested}
              onChange={(e) => setSuggested(e.target.value)}
              className="h-11 rounded-md border bg-card px-3 text-sm"
            >
              <option value="">Sem sugestão</option>
              {substitutes.data?.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.name}
                </option>
              ))}
            </select>
            {substitutes.data?.length === 0 && (
              <p className="text-caption text-muted-foreground">
                Ninguém livre com a mesma função nessa data.
              </p>
            )}
          </div>
          <FormError error={respond.error} />
        </div>
      </ConfirmDialog>
    </div>
  );
}
