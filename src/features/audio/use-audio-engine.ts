import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { attachSoundTouch, isSoundTouchSupported, type PitchChain } from '@/lib/audio/soundtouch';

export type AudioEngine = 'soundtouch' | 'nativo' | 'parado';

/**
 * Motor de um <audio>: tocar/pausar, posição, duração, velocidade (playbackRate) e tom
 * (SoundTouch no AudioWorklet, ligado no primeiro toque). Usado pelo player completo (ensaio)
 * e pelo dock da tela da música.
 */
export function useAudioEngine({
  speed,
  pitch,
  durationSeconds,
}: {
  speed: number;
  /** Semitons (−6 a +6). */
  pitch: number;
  durationSeconds?: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const chainRef = useRef<PitchChain | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [engine, setEngine] = useState<AudioEngine>('parado');
  const [error, setError] = useState<string | null>(null);

  // Aplica tom e velocidade sempre que mudarem.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (chainRef.current) {
      chainRef.current.setSpeed(speed);
      chainRef.current.setSemitones(pitch);
    } else {
      // Sem SoundTouch (ou antes do primeiro play): velocidade nativa, sem mudar o tom.
      audio.preservesPitch = true;
      audio.playbackRate = speed;
    }
  }, [speed, pitch, engine]);

  const ensureEngine = async () => {
    const audio = audioRef.current;
    if (!audio || chainRef.current || engine === 'nativo') return;
    if (!isSoundTouchSupported()) {
      setEngine('nativo');
      return;
    }
    try {
      chainRef.current = await attachSoundTouch(audio);
      chainRef.current.setSpeed(speed);
      chainRef.current.setSemitones(pitch);
      setEngine('soundtouch');
    } catch {
      setEngine('nativo');
      setError('Mudar o tom não funciona neste navegador; a velocidade continua disponível.');
    }
  };

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await ensureEngine();
      try {
        await audio.play();
      } catch {
        setError('Não foi possível tocar este áudio.');
      }
    } else {
      audio.pause();
    }
  };

  const total = duration || durationSeconds || 0;

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = seconds;
  };

  const seekBy = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(
      0,
      Math.min(total || audio.duration || 0, audio.currentTime + delta),
    );
  };

  /** Eventos do <audio> (espalhar no elemento junto com `ref={audioRef}`). */
  const audioProps = {
    preload: 'metadata' as const,
    crossOrigin: 'anonymous' as const,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
    onTimeUpdate: (e: SyntheticEvent<HTMLAudioElement>) => setTime(e.currentTarget.currentTime),
    onLoadedMetadata: (e: SyntheticEvent<HTMLAudioElement>) => {
      const d = e.currentTarget.duration;
      if (Number.isFinite(d) && d > 0) setDuration(d);
    },
    onError: () => setError('Não foi possível carregar o áudio.'),
  };

  return {
    audioRef,
    audioProps,
    playing,
    time,
    total,
    engine,
    /** O tom do áudio pode mudar? (no modo nativo, só a velocidade). */
    pitchAvailable: engine !== 'nativo',
    error,
    toggle,
    seekTo,
    seekBy,
  };
}
