/**
 * Tom do áudio de referência acompanhando o tom escolhido na cifra.
 * O áudio está no tom ORIGINAL da música; se a cifra está em outro tom, o player muda a
 * altura pela diferença — pelo caminho mais curto (ex.: G → F é −2, não +10), porque cada
 * semitom a mais deixa o som mais artificial.
 */
import { parseKey } from '@/lib/chords';

/** Diferença de `fromKey` para `toKey` em semitons, entre −6 e +5. `null` se faltar tom. */
export function shortestSemitones(fromKey: string | null, toKey: string | null): number | null {
  if (!fromKey || !toKey) return null;
  const from = parseKey(fromKey);
  const to = parseKey(toKey);
  if (!from || !to) return null;
  const up = (((to.pitch - from.pitch) % 12) + 12) % 12; // 0..11
  return up > 5 ? up - 12 : up;
}

export const PITCH_MIN = -6;
export const PITCH_MAX = 6;
export const SPEED_MIN = 0.5;
export const SPEED_MAX = 1;
export const SPEED_STEP = 0.05;

export function clampPitch(semitones: number): number {
  return Math.max(PITCH_MIN, Math.min(PITCH_MAX, Math.round(semitones)));
}

export function clampSpeed(speed: number): number {
  const stepped = Math.round(speed / SPEED_STEP) * SPEED_STEP;
  return Math.max(SPEED_MIN, Math.min(SPEED_MAX, Number(stepped.toFixed(2))));
}

/** "+2", "−3", "0" (com o sinal de menos tipográfico). */
export function formatSemitoneShift(semitones: number): string {
  if (semitones === 0) return '0';
  return semitones > 0 ? `+${semitones}` : `−${Math.abs(semitones)}`;
}

/** "75%". */
export function formatSpeed(speed: number): string {
  return `${Math.round(speed * 100)}%`;
}
