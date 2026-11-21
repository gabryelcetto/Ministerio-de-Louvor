import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import {
  clampSpeed,
  formatSemitoneShift,
  formatSpeed,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_STEP,
} from '@/lib/audio/semitones';
import { cn } from '@/lib/utils';
import type { SongAudioState } from '../song-audio';

/**
 * Ajustes finos do áudio que está no dock: velocidade (50–100%, sem mudar o tom) e tom
 * (acompanha a cifra ou ajuste manual de −6 a +6 semitons).
 */
export function AudioSettingsPanel({ state }: { state: SongAudioState }) {
  const id = useId();
  const canFollow = state.followSemitones !== null;
  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
    >
      <h3 id={`${id}-titulo`} className="section-label">
        Ajustes do áudio
      </h3>
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Velocidade</legend>
        <span className="w-24 text-sm font-semibold" id={`${id}-vel`}>
          Velocidade
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => state.setSpeed(clampSpeed(state.speed - SPEED_STEP))}
          disabled={state.speed <= SPEED_MIN}
          aria-label="Diminuir velocidade"
        >
          <Minus aria-hidden="true" />
        </Button>
        <output
          aria-labelledby={`${id}-vel`}
          aria-live="polite"
          className="w-14 text-center text-lg font-bold tabular-nums"
        >
          {formatSpeed(state.speed)}
        </output>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => state.setSpeed(clampSpeed(state.speed + SPEED_STEP))}
          disabled={state.speed >= SPEED_MAX}
          aria-label="Aumentar velocidade"
        >
          <Plus aria-hidden="true" />
        </Button>
        {[0.5, 0.75, 1].map((preset) => (
          <Button
            key={preset}
            type="button"
            variant={state.speed === preset ? 'default' : 'ghost'}
            onClick={() => state.setSpeed(preset)}
            aria-pressed={state.speed === preset}
          >
            {formatSpeed(preset)}
          </Button>
        ))}
      </fieldset>

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Tom do áudio</legend>
        <span className="w-24 text-sm font-semibold" id={`${id}-tom`}>
          Tom
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => state.setManualPitch(state.pitch - 1)}
          aria-label="Descer meio tom do áudio"
        >
          <Minus aria-hidden="true" />
        </Button>
        <output
          aria-labelledby={`${id}-tom`}
          aria-live="polite"
          className="w-14 text-center text-lg font-bold tabular-nums"
        >
          {formatSemitoneShift(state.pitch)}
        </output>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => state.setManualPitch(state.pitch + 1)}
          aria-label="Subir meio tom do áudio"
        >
          <Plus aria-hidden="true" />
        </Button>
        {canFollow && (
          <label
            className={cn(
              'flex min-h-11 items-center gap-2 text-sm',
              !state.follow && 'opacity-90',
            )}
          >
            <input
              type="checkbox"
              checked={state.follow}
              onChange={(e) => state.setFollow(e.target.checked)}
              className="size-5 accent-[var(--ds-accent)]"
            />
            Acompanhar o tom da cifra{state.followLabel ? ` (${state.followLabel})` : ''}
          </label>
        )}
      </fieldset>
    </section>
  );
}
