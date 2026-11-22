import { ArrowLeftRight, XCircle } from 'lucide-react';
import { FormError } from '@/components/common/form-error';
import { Button } from '@/components/ui/button';
import { useSingleFlight } from '@/hooks/use-single-flight';
import type { AssignmentInfo } from '../api';
import { useSubstitutes, useSwapAssignment } from '../presence-api';

/** Recusas do evento para quem monta a escala: motivo, sugestão e "Trocar por Fulano". */
export function DeclinesPanel({ assignments }: { assignments: AssignmentInfo[] }) {
  const declined = assignments.filter((a) => a.response === 'declined');
  if (declined.length === 0) return null;
  return (
    <section aria-labelledby="recusas-titulo" className="flex flex-col gap-2">
      <h2 id="recusas-titulo" className="section-label">
        Não podem ir
      </h2>
      <ul aria-label="Não podem ir" className="flex flex-col gap-2">
        {declined.map((a) => (
          <DeclineRow key={a.id} assignment={a} />
        ))}
      </ul>
    </section>
  );
}

function DeclineRow({ assignment }: { assignment: AssignmentInfo }) {
  const substitutes = useSubstitutes(assignment.id);
  const swap = useSwapAssignment();
  const run = useSingleFlight();
  const list = [...(substitutes.data ?? [])].sort(
    (a, b) =>
      Number(b.user_id === assignment.suggestedUserId) -
      Number(a.user_id === assignment.suggestedUserId),
  );

  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <p className="flex items-start gap-2 text-sm">
        <XCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
        <span>
          <strong>{assignment.name}</strong> não pode ({assignment.functionName})
          {assignment.note && (
            <span className="block text-muted-foreground">{assignment.note}</span>
          )}
        </span>
      </p>
      {substitutes.isPending ? (
        <p className="text-caption text-muted-foreground">Procurando quem pode substituir…</p>
      ) : list.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          Ninguém livre com a mesma função nessa data.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.slice(0, 4).map((s) => (
            <Button
              key={s.user_id}
              type="button"
              size="sm"
              variant={s.user_id === assignment.suggestedUserId ? 'default' : 'outline'}
              disabled={swap.isPending}
              onClick={() =>
                run(() =>
                  swap.mutateAsync({ assignmentId: assignment.id, userId: s.user_id }),
                ).catch(() => {})
              }
            >
              <ArrowLeftRight aria-hidden="true" />
              Trocar por {s.name}
              {s.user_id === assignment.suggestedUserId && (
                <span className="font-normal"> (sugestão)</span>
              )}
            </Button>
          ))}
        </div>
      )}
      <FormError error={swap.error ?? substitutes.error} />
    </li>
  );
}
