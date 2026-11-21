import { Minus, Pause, Play, Plus, RotateCcw, RotateCw } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatDuration } from '@/lib/audio/limits';
import {
  clampPitch,
  clampSpeed,
  formatSemitoneShift,
  formatSpeed,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_STEP,
} from '@/lib/audio/semitones';
import { cn } from '@/lib/utils';
import { useAudioEngine } from '../use-audio-engine';

/**
 * Player com velocidade (50–100%, sem mudar o tom) e tom (−6 a +6 semitons, sem mudar o
 * andamento), tudo no aparelho. Controles grandes, para o polegar.
 * `followSemitones`: quando vem da tela da música, o tom acompanha o tom escolhido na cifra
 * (diferença para o tom original); a pessoa pode desligar e ajustar à mão.
 */
export function AudioPlayer({
  src,
  label,
  durationSeconds,
  followSemitones,
  followLabel,
}: {
  src: string;
  label: string;
  durationSeconds: number | null;
  followSemitones?: number | null;
  /** Ex.: "tom da cifra: A (+2)". */
  followLabel?: string;
}) {
  const id = useId();
  const [speed, setSpeed] = useState(1);
  const [manualPitch, setManualPitch] = useState(0);
  const canFollow = followSemitones !== undefined && followSemitones !== null;
  const [follow, setFollow] = useState(true);
  const pitch = canFollow && follow ? clampPitch(followSemitones) : manualPitch;
  const {
    audioRef,
    audioProps,
    playing,
    time,
    total,
    engine,
    pitchAvailable,
    error,
    toggle,
    seekTo,
    seekBy,
  } = useAudioEngine({ speed, pitch, durationSeconds });

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border bg-card p-3"
      data-testid="audio-player"
      data-engine={engine}
      data-pitch={pitch}
      data-speed={speed}
    >
      <audio ref={audioRef} src={src} {...audioProps} />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          className="size-14 shrink-0 rounded-full"
          onClick={() => void toggle()}
          aria-label={playing ? `Pausar ${label}` : `Tocar ${label}`}
        >
          {playing ? (
            <Pause aria-hidden="true" className="size-6" />
          ) : (
            <Play aria-hidden="true" className="size-6" />
          )}
        </Button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            type="range"
            min={0}
            max={total || 0}
            step={1}
            value={Math.min(time, total || time)}
            disabled={!total}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label={`Posição em ${label}`}
            className="h-8 w-full accent-[var(--primary)]"
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDuration(time)} / {total ? formatDuration(total) : '—'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 min-w-12"
          onClick={() => seekBy(-10)}
        >
          <RotateCcw aria-hidden="true" />
          <span aria-hidden="true">10s</span>
          <span className="sr-only">Voltar 10 segundos</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 min-w-12"
          onClick={() => seekBy(10)}
        >
          <RotateCw aria-hidden="true" />
          <span aria-hidden="true">10s</span>
          <span className="sr-only">Avançar 10 segundos</span>
        </Button>
      </div>

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Velocidade</legend>
        <span className="w-24 text-sm font-medium" id={`${id}-vel`}>
          Velocidade
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-12"
          onClick={() => setSpeed((s) => clampSpeed(s - SPEED_STEP))}
          disabled={speed <= SPEED_MIN}
          aria-label="Diminuir velocidade"
        >
          <Minus aria-hidden="true" />
        </Button>
        <output
          aria-labelledby={`${id}-vel`}
          aria-live="polite"
          className="w-14 text-center text-lg font-semibold tabular-nums"
        >
          {formatSpeed(speed)}
        </output>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-12"
          onClick={() => setSpeed((s) => clampSpeed(s + SPEED_STEP))}
          disabled={speed >= SPEED_MAX}
          aria-label="Aumentar velocidade"
        >
          <Plus aria-hidden="true" />
        </Button>
        {[0.5, 0.75, 1].map((preset) => (
          <Button
            key={preset}
            type="button"
            variant={speed === preset ? 'default' : 'ghost'}
            className="h-12"
            onClick={() => setSpeed(preset)}
            aria-pressed={speed === preset}
          >
            {formatSpeed(preset)}
          </Button>
        ))}
      </fieldset>

      <fieldset className="flex flex-wrap items-center gap-2" disabled={!pitchAvailable}>
        <legend className="sr-only">Tom</legend>
        <span className="w-24 text-sm font-medium" id={`${id}-tom`}>
          Tom
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-12"
          onClick={() => {
            setFollow(false);
            setManualPitch(clampPitch(pitch - 1));
          }}
          aria-label="Descer meio tom do áudio"
        >
          <Minus aria-hidden="true" />
        </Button>
        <output
          aria-labelledby={`${id}-tom`}
          aria-live="polite"
          className="w-14 text-center text-lg font-semibold tabular-nums"
        >
          {formatSemitoneShift(pitch)}
        </output>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-12"
          onClick={() => {
            setFollow(false);
            setManualPitch(clampPitch(pitch + 1));
          }}
          aria-label="Subir meio tom do áudio"
        >
          <Plus aria-hidden="true" />
        </Button>
        {canFollow && (
          <label
            className={cn(
              'flex min-h-12 items-center gap-2 text-sm',
              !pitchAvailable && 'opacity-60',
            )}
          >
            <input
              type="checkbox"
              checked={follow}
              onChange={(e) => {
                setFollow(e.target.checked);
                if (!e.target.checked) setManualPitch(pitch);
              }}
              className="size-5 accent-[var(--primary)]"
            />
            Acompanhar o tom da cifra{followLabel ? ` (${followLabel})` : ''}
          </label>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
