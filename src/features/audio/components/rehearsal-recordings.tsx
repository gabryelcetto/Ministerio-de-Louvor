import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mic, Pause, Play, Square, Sun, TriangleAlert, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { friendlyError } from '@/lib/errors';
import { formatBytes, formatDuration, MAX_AUDIO_BYTES } from '@/lib/audio/limits';
import {
  assembleRecording,
  deleteSession,
  listSessions,
  saveSession,
  type RecordingSession,
} from '@/lib/audio/recording-store';
import { useEventRecordings, useUploadAudio } from '../api';
import { useRecorder } from '../use-recorder';
import { MediaList } from './media-list';

/** Gravações do ensaio: gravar, enviar (com progresso e nova tentativa) e ouvir. */
export function RehearsalRecordings({ eventId }: { eventId: string }) {
  const client = useQueryClient();
  const recordings = useEventRecordings(eventId);
  const pending = useQuery({
    queryKey: ['recordings', 'local', eventId],
    // Sessões que ficaram "gravando" (o app fechou no meio) também podem ser enviadas.
    queryFn: async () => {
      const sessions = await listSessions(eventId);
      for (const s of sessions.filter((x) => x.status === 'recording')) {
        await saveSession({ ...s, status: 'stopped' });
      }
      return listSessions(eventId);
    },
  });
  const refreshPending = useCallback(
    () => client.invalidateQueries({ queryKey: ['recordings', 'local', eventId] }),
    [client, eventId],
  );
  const recorder = useRecorder(eventId, () => void refreshPending());

  return (
    <section aria-labelledby="gravacoes-titulo" className="flex flex-col gap-4">
      <h2 id="gravacoes-titulo" className="text-lg font-semibold">
        Gravações do ensaio
      </h2>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {recorder.state === 'idle' || recorder.state === 'starting' ? (
            <Button
              type="button"
              size="lg"
              className="h-14 px-6 text-base"
              onClick={() => void recorder.start()}
              disabled={recorder.state === 'starting'}
            >
              <Mic aria-hidden="true" className="size-5" />
              {recorder.state === 'starting' ? 'Abrindo o microfone…' : 'Gravar ensaio'}
            </Button>
          ) : (
            <>
              {recorder.state === 'recording' ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-14 px-5 text-base"
                  onClick={recorder.pause}
                >
                  <Pause aria-hidden="true" className="size-5" />
                  Pausar
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-14 px-5 text-base"
                  onClick={recorder.resume}
                  disabled={recorder.state === 'stopping'}
                >
                  <Play aria-hidden="true" className="size-5" />
                  Retomar
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="h-14 px-5 text-base"
                onClick={recorder.stop}
                disabled={recorder.state === 'stopping'}
              >
                <Square aria-hidden="true" className="size-5" />
                Parar
              </Button>
            </>
          )}
          {recorder.state !== 'idle' && recorder.state !== 'starting' && (
            <div className="flex flex-col" aria-live="polite">
              <span className="text-2xl font-semibold tabular-nums" data-testid="cronometro">
                {recorder.state === 'paused' ? '⏸ ' : '● '}
                {formatDuration(recorder.elapsedMs / 1000)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatBytes(recorder.bytes)} de {formatBytes(MAX_AUDIO_BYTES)}
                {recorder.wakeLockOn && (
                  <>
                    {' · '}
                    <Sun aria-hidden="true" className="inline size-3" /> tela acesa
                  </>
                )}
              </span>
            </div>
          )}
        </div>
        {recorder.level === 'warn' && recorder.state !== 'idle' && (
          <p role="alert" className="flex items-start gap-2 text-sm">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>
              A gravação está chegando ao limite de {formatBytes(MAX_AUDIO_BYTES)}. Ela vai parar
              sozinha antes; para continuar, comece outra.
            </span>
          </p>
        )}
        {recorder.autoStopped && (
          <p role="alert" className="text-sm">
            A gravação parou sozinha perto do limite de {formatBytes(MAX_AUDIO_BYTES)}. Comece outra
            para continuar.
          </p>
        )}
        {recorder.error && (
          <p role="alert" className="text-sm text-destructive">
            {recorder.error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          A gravação fica salva no aparelho enquanto grava: se o app fechar ou a internet cair, ela
          aparece aqui para enviar.
        </p>
      </div>

      {pending.data && pending.data.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Gravações não enviadas">
          {pending.data.map((s) => (
            <PendingRecording key={s.id} session={s} eventId={eventId} onDone={refreshPending} />
          ))}
        </ul>
      )}

      {recordings.isPending ? (
        <LoadingState label="Carregando gravações…" />
      ) : recordings.isError ? (
        <ErrorState onRetry={() => void recordings.refetch()} />
      ) : (
        <MediaList
          items={recordings.data}
          kind="rehearsal"
          targetId={eventId}
          emptyText="Nenhuma gravação deste ensaio ainda."
        />
      )}
    </section>
  );
}

function PendingRecording({
  session,
  eventId,
  onDone,
}: {
  session: RecordingSession;
  eventId: string;
  onDone: () => void;
}) {
  const upload = useUploadAudio('rehearsal', eventId);
  const [progress, setProgress] = useState(0);
  const [discarding, setDiscarding] = useState(false);

  const send = async () => {
    setProgress(0);
    const blob = await assembleRecording(session);
    upload.mutate(
      {
        blob,
        mimeType: session.mimeType,
        extension: session.extension,
        durationSeconds: session.durationMs / 1000,
        onProgress: setProgress,
      },
      {
        onSuccess: async () => {
          await deleteSession(session.id);
          onDone();
        },
      },
    );
  };

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-accent bg-accent/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          <span className="font-medium">Gravação não enviada</span>
          <span className="text-muted-foreground">
            {' '}
            · {formatDuration(session.durationMs / 1000)} · {formatBytes(session.bytes)}
          </span>
        </span>
        <span className="flex gap-2">
          <Button type="button" onClick={() => void send()} disabled={upload.isPending}>
            <Upload aria-hidden="true" />
            {upload.isError ? 'Tentar de novo' : upload.isPending ? 'Enviando…' : 'Enviar'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDiscarding(true)}
            disabled={upload.isPending}
          >
            Descartar
          </Button>
        </span>
      </div>
      {upload.isPending && (
        <div className="flex items-center gap-2">
          <progress
            max={1}
            value={progress}
            aria-label="Progresso do envio"
            className="h-3 w-full accent-[var(--primary)]"
          />
          <span className="w-12 text-right text-sm tabular-nums">
            {Math.round(progress * 100)}%
          </span>
        </div>
      )}
      {upload.isError && (
        <p role="alert" className="text-sm text-destructive">
          {friendlyError(upload.error, 'Não foi possível enviar a gravação.')} A gravação continua
          salva no aparelho.
        </p>
      )}
      <ConfirmDialog
        open={discarding}
        title="Descartar esta gravação?"
        confirmLabel="Descartar"
        destructive
        onCancel={() => setDiscarding(false)}
        onConfirm={() => {
          void deleteSession(session.id).then(() => {
            setDiscarding(false);
            onDone();
          });
        }}
      >
        Ela ainda não foi enviada: descartar apaga do aparelho e não dá para desfazer.
      </ConfirmDialog>
    </li>
  );
}
