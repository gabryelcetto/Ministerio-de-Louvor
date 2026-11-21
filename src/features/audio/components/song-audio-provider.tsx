import { useMemo, useState, type ReactNode } from 'react';
import { clampPitch, formatSemitoneShift } from '@/lib/audio/semitones';
import { useSongReferences } from '../api';
import { SongAudioContext, type SongAudioState } from '../song-audio';

/** Guarda qual áudio de referência está no dock e os ajustes de velocidade e tom. */
export function SongAudioProvider({
  songId,
  followSemitones,
  shownKey,
  children,
}: {
  songId: string;
  followSemitones: number | null;
  shownKey: string | null;
  children: ReactNode;
}) {
  const references = useSongReferences(songId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [follow, setFollow] = useState(true);
  const [manualPitch, setManualPitch] = useState(0);

  const list = useMemo(() => references.data ?? [], [references.data]);
  // Padrão: o primeiro (mais recente). Se o escolhido for apagado, volta ao primeiro.
  const selected = list.find((m) => m.id === selectedId) ?? list[0] ?? null;
  const canFollow = followSemitones !== null;
  const pitch = canFollow && follow ? clampPitch(followSemitones) : manualPitch;

  const value: SongAudioState = {
    songId,
    references: list,
    selected,
    select: setSelectedId,
    speed,
    setSpeed,
    follow: canFollow && follow,
    setFollow: (next) => {
      if (!next) setManualPitch(pitch);
      setFollow(next);
    },
    manualPitch,
    setManualPitch: (next) => {
      setFollow(false);
      setManualPitch(clampPitch(next));
    },
    followSemitones,
    followLabel:
      canFollow && shownKey ? `${shownKey}: ${formatSemitoneShift(followSemitones)}` : undefined,
    pitch,
  };
  return <SongAudioContext.Provider value={value}>{children}</SongAudioContext.Provider>;
}
