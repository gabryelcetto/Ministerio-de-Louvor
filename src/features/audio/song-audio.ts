import { createContext, useContext } from 'react';
import type { MediaItem } from './api';

/**
 * Áudio de referência na tela da música: qual está no dock, velocidade e tom. O dock (embaixo)
 * toca; a seção "Áudios de referência" escolhe qual tocar e tem os ajustes finos. O tom do
 * áudio acompanha a transposição da cifra (followSemitones), a menos que a pessoa ajuste à mão.
 */
export interface SongAudioState {
  songId: string;
  references: MediaItem[];
  selected: MediaItem | null;
  select: (id: string) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  follow: boolean;
  setFollow: (follow: boolean) => void;
  manualPitch: number;
  setManualPitch: (pitch: number) => void;
  /** Diferença do tom original do áudio até o tom na tela (null = sem tom conhecido). */
  followSemitones: number | null;
  /** Ex.: "A: +2". */
  followLabel?: string;
  /** Tom aplicado no áudio agora (semitons). */
  pitch: number;
}

export const SongAudioContext = createContext<SongAudioState | null>(null);

/** Estado do áudio da música (null fora da tela da música). */
export function useSongAudio(): SongAudioState | null {
  return useContext(SongAudioContext);
}

/** Atalhos do chip de velocidade do dock: 100% → 75% → 50% → 100%. */
export const SPEED_CYCLE = [1, 0.75, 0.5] as const;

export function nextSpeed(current: number): number {
  const index = SPEED_CYCLE.findIndex((s) => Math.abs(s - current) < 0.001);
  return SPEED_CYCLE[(index + 1) % SPEED_CYCLE.length] ?? 1;
}
