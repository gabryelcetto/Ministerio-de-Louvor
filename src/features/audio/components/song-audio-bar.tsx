import { Pause, Play } from 'lucide-react';
import { formatDuration } from '@/lib/audio/limits';
import { formatSpeed } from '@/lib/audio/semitones';
import { mediaTitle } from '../api';
import { nextSpeed, useSongAudio } from '../song-audio';
import { useAudioEngine } from '../use-audio-engine';

/**
 * Linha 1 do dock da tela da música (só quando a música tem áudio de referência):
 * tocar/pausar, nome, tempo, barra de progresso e o chip de velocidade.
 */
export function SongAudioBar() {
  const state = useSongAudio();
  const selected = state?.selected;
  if (!state || !selected?.url) return null;
  const position = state.references.length - state.references.indexOf(selected);
  // key: trocar de áudio recomeça o motor (outro <audio>).
  return (
    <AudioBarInner
      key={selected.id}
      src={selected.url}
      label={mediaTitle('reference', selected.label, position)}
      durationSeconds={selected.durationSeconds}
      speed={state.speed}
      pitch={state.pitch}
      onSpeed={() => state.setSpeed(nextSpeed(state.speed))}
    />
  );
}

function AudioBarInner({
  src,
  label,
  durationSeconds,
  speed,
  pitch,
  onSpeed,
}: {
  src: string;
  label: string;
  durationSeconds: number | null;
  speed: number;
  pitch: number;
  onSpeed: () => void;
}) {
  const { audioRef, audioProps, playing, time, total, engine, error, toggle, seekTo } =
    useAudioEngine({ speed, pitch, durationSeconds });

  return (
    <div
      className="flex flex-col gap-1"
      data-testid="audio-player"
      data-engine={engine}
      data-pitch={pitch}
      data-speed={speed}
    >
      <audio ref={audioRef} src={src} {...audioProps} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void toggle()}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {playing ? (
            <Pause aria-hidden="true" className="size-5" />
          ) : (
            <Play aria-hidden="true" className="size-5 translate-x-px" />
          )}
          <span className="sr-only">{playing ? `Pausar ${label}` : `Tocar ${label}`}</span>
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold">{label}</span>
            <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
              {formatDuration(time)} / {total ? formatDuration(total) : '—'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={total || 0}
            step={1}
            value={Math.min(time, total || time)}
            disabled={!total}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label={`Posição em ${label}`}
            className="h-6 w-full cursor-pointer accent-[var(--ds-accent)]"
          />
        </div>
        <button
          type="button"
          onClick={onSpeed}
          aria-label={`Velocidade ${formatSpeed(speed)}`}
          className="flex h-11 min-w-14 shrink-0 items-center justify-center rounded-lg bg-chip px-2 text-sm font-bold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {formatSpeed(speed)}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
