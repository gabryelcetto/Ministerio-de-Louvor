import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mic, Pause, Play, Square, Sun, TriangleAlert, Upload } from 'lucide-react';
import { useCallback, useId, useMemo, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { friendlyError } from '@/lib/errors';
import {
  formatBytes,
  formatDuration,
  MAX_AUDIO_BYTES,
  type RecordingSizeLevel,
} from '@/lib/audio/limits';
import {
  assembleRecording,
  deleteSession,
  listSessions,
  saveSession,
  type RecordingSession,
} from '@/lib/audio/recording-store';
import { cn } from '@/lib/utils';
import { useUploadAudio, type MediaKind } from '../api';
import { useRecorder, type RecorderState } from '../use-recorder';

/** O que os controles precisam saber do gravador (o hook useRecorder entrega isso). */
export interface RecorderView {
  state: RecorderState;
  elapsedMs: number;
  bytes: number;
  level: RecordingSizeLevel;
  error: string | null;
  autoStopped: boolean;
  wakeLockOn: boolean;
}

/**
 * Botões e estado da gravação (Gravar / Pausar / Retomar / Parar, cronômetro, tamanho, tela
 * acesa e avisos de 45 MB). Só apresentação: quem grava é o useRecorder.
 */
export function RecorderControls({
  recorder,
  startLabel,
  large = false,
  disabled = false,
  extraActions,
  onStart,
  onPause,
  onResume,
  onStop,
}: {
  recorder: RecorderView;
  startLabel: string;
  /** Botões grandes (gravação de ensaio, celular apoiado longe). */
  large?: boolean;
  disabled?: boolean;
  /** Ações ao lado de "Gravar" quando parado (ex.: "Enviar áudio"). */
  extraActions?: ReactNode;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const idle = recorder.state === 'idle' || recorder.state === 'starting';
  const big = large ? 'h-14 px-5 text-base' : undefined;
  const icon = large ? 'size-5' : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {idle ? (
          <>
            <Button
              type="button"
              size={large ? 'lg' : 'default'}
              className={cn(large && 'h-14 px-6 text-base')}
              onClick={onStart}
              disabled={disabled || recorder.state === 'starting'}
              data-gravar
            >
              <Mic aria-hidden="true" className={icon} />
              {recorder.state === 'starting' ? 'Abrindo o microfone…' : startLabel}
            </Button>
            {extraActions}
          </>
        ) : (
          <>
            {recorder.state === 'recording' ? (
              <Button
                type="button"
                variant="outline"
                size={large ? 'lg' : 'default'}
                className={big}
                onClick={onPause}
              >
                <Pause aria-hidden="true" className={icon} />
                Pausar
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size={large ? 'lg' : 'default'}
                className={big}
                onClick={onResume}
                disabled={recorder.state === 'stopping'}
              >
                <Play aria-hidden="true" className={icon} />
                Retomar
              </Button>
            )}
            <Button
              type="button"
              variant="destructive"
              size={large ? 'lg' : 'default'}
              className={big}
              onClick={onStop}
              disabled={recorder.state === 'stopping'}
            >
              <Square aria-hidden="true" className={icon} />
              Parar
            </Button>
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
          </>
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
    </div>
  );
}

/**
 * Controles do dock de gravação (ensaio): botão redondo de 64px na cor de gravação, com anel,
 * o texto "Gravar ensaio" e a dica. Gravando: cronômetro, pausar/retomar e parar.
 */
export function RecorderDockControls({
  recorder,
  startLabel,
  hint,
  disabled = false,
  onStart,
  onPause,
  onResume,
  onStop,
}: {
  recorder: RecorderView;
  startLabel: string;
  hint?: ReactNode;
  disabled?: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const idle = recorder.state === 'idle' || recorder.state === 'starting';
  const hintId = useId();
  const round =
    'flex size-16 shrink-0 items-center justify-center rounded-full bg-rec text-white ring-4 ring-rec-ring';
  return (
    <div className="flex flex-col gap-2">
      {idle ? (
        <button
          type="button"
          onClick={onStart}
          disabled={disabled || recorder.state === 'starting'}
          data-gravar
          aria-describedby={hint ? hintId : undefined}
          className="flex items-center gap-4 self-start rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <span aria-hidden="true" className={round}>
            <Mic className="size-7" />
          </span>
          <span className="text-card-title">
            {recorder.state === 'starting' ? 'Abrindo o microfone…' : startLabel}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onStop}
            disabled={recorder.state === 'stopping'}
            className={cn(round, 'focus-visible:outline-none focus-visible:ring-ring')}
          >
            <Square aria-hidden="true" className="size-6 fill-current" />
            <span className="sr-only">Parar</span>
          </button>
          <div className="flex min-w-0 flex-1 flex-col" aria-live="polite">
            <span className="text-2xl font-extrabold tabular-nums" data-testid="cronometro">
              {recorder.state === 'paused' ? '⏸ ' : '● '}
              {formatDuration(recorder.elapsedMs / 1000)}
            </span>
            <span className="text-caption text-muted-foreground">
              {formatBytes(recorder.bytes)} de {formatBytes(MAX_AUDIO_BYTES)}
              {recorder.wakeLockOn && ' · tela acesa'}
            </span>
          </div>
          {recorder.state === 'recording' ? (
            <Button type="button" variant="outline" size="lg" onClick={onPause}>
              <Pause aria-hidden="true" />
              Pausar
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onResume}
              disabled={recorder.state === 'stopping'}
            >
              <Play aria-hidden="true" />
              Retomar
            </Button>
          )}
        </div>
      )}
      {idle && hint && (
        <p id={hintId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      )}
      {recorder.level === 'warn' && recorder.state !== 'idle' && (
        <p role="alert" className="text-sm">
          A gravação está chegando ao limite de {formatBytes(MAX_AUDIO_BYTES)}. Ela vai parar
          sozinha antes; para continuar, comece outra.
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
    </div>
  );
}

/**
 * Gravação completa num alvo (ensaio ou música): controles, pedaços salvos no aparelho
 * enquanto grava, lista de "não enviadas" com envio (progresso e nova tentativa) e descarte.
 * `onUploaded` recebe o id do áudio enviado (para pedir o nome).
 */
export function AudioRecorder({
  kind,
  targetId,
  startLabel,
  large,
  disabled,
  extraActions,
  hint,
  onUploaded,
  layout = 'card',
  warning,
}: {
  kind: MediaKind;
  targetId: string;
  startLabel: string;
  large?: boolean;
  disabled?: boolean;
  extraActions?: ReactNode;
  hint?: ReactNode;
  onUploaded?: (mediaId: string) => void;
  /** 'dock': controles fixos embaixo da tela, com o botão redondo de gravar (ensaio). */
  layout?: 'card' | 'dock';
  /** Aviso extra no dock (ex.: iPhone interrompe a gravação ao bloquear a tela). */
  warning?: ReactNode;
}) {
  const client = useQueryClient();
  const target = useMemo(() => ({ kind, targetId }), [kind, targetId]);
  const queryKey = useMemo(() => ['recordings', 'local', kind, targetId], [kind, targetId]);
  const pending = useQuery({
    queryKey,
    // Sessões que ficaram "gravando" (o app fechou no meio) também podem ser enviadas.
    queryFn: async () => {
      const sessions = await listSessions(target);
      for (const s of sessions.filter((x) => x.status === 'recording')) {
        await saveSession({ ...s, status: 'stopped' });
      }
      return listSessions(target);
    },
  });
  const refreshPending = useCallback(
    () => client.invalidateQueries({ queryKey }),
    [client, queryKey],
  );
  const recorder = useRecorder(target, () => void refreshPending());

  const controls =
    layout === 'dock' ? (
      <>
        <div
          role="region"
          aria-label="Gravação"
          className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 border-t bg-card px-4 py-3 md:bottom-0 md:left-60 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
          <div className="mx-auto flex max-w-[45rem] flex-col gap-2">
            <RecorderDockControls
              recorder={recorder}
              startLabel={startLabel}
              hint={hint}
              disabled={disabled}
              onStart={() => void recorder.start()}
              onPause={recorder.pause}
              onResume={recorder.resume}
              onStop={recorder.stop}
            />
            {warning && recorder.state === 'idle' && (
              <p className="text-caption text-muted-foreground">{warning}</p>
            )}
          </div>
        </div>
      </>
    ) : null;

  return (
    <div className="flex flex-col gap-3">
      {controls}
      {layout === 'card' && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <RecorderControls
            recorder={recorder}
            startLabel={startLabel}
            large={large}
            disabled={disabled}
            extraActions={extraActions}
            onStart={() => void recorder.start()}
            onPause={recorder.pause}
            onResume={recorder.resume}
            onStop={recorder.stop}
          />
          <p className="text-xs text-muted-foreground">
            {hint ??
              'A gravação fica salva no aparelho enquanto grava: se o app fechar ou a internet cair, ela aparece aqui para enviar.'}
          </p>
        </div>
      )}

      {pending.data && pending.data.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Gravações não enviadas">
          {pending.data.map((s) => (
            <PendingRecording
              key={s.id}
              session={s}
              kind={kind}
              targetId={targetId}
              onDone={refreshPending}
              onUploaded={onUploaded}
            />
          ))}
        </ul>
      )}
      {/* Espaço para o dock fixo não cobrir o fim da página. */}
      {layout === 'dock' && <div aria-hidden="true" className="h-36" />}
    </div>
  );
}

function PendingRecording({
  session,
  kind,
  targetId,
  onDone,
  onUploaded,
}: {
  session: RecordingSession;
  kind: MediaKind;
  targetId: string;
  onDone: () => void;
  onUploaded?: (mediaId: string) => void;
}) {
  const upload = useUploadAudio(kind, targetId);
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
        onSuccess: async (mediaId) => {
          await deleteSession(session.id);
          onDone();
          onUploaded?.(mediaId);
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
          <Button
            type="button"
            needsNetwork
            onClick={() => void send()}
            disabled={upload.isPending}
          >
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
      {upload.isPending && <UploadProgress value={progress} />}
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

/** Barra de progresso do envio (gravação ou arquivo). */
export function UploadProgress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <progress
        max={1}
        value={value}
        aria-label="Progresso do envio"
        className="h-3 w-full accent-[var(--primary)]"
      />
      <span className="w-12 text-right text-sm tabular-nums">{Math.round(value * 100)}%</span>
    </div>
  );
}
