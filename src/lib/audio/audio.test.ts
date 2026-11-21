import { describe, expect, it } from 'vitest';
import { baseMimeType, chooseRecordingFormat, extensionFor } from './format';
import {
  audioFileProblem,
  formatBytes,
  formatDuration,
  MAX_AUDIO_BYTES,
  minutesThatFit,
  recordingSizeLevel,
  STOP_AUDIO_BYTES,
  WARN_AUDIO_BYTES,
} from './limits';
import {
  clampPitch,
  clampSpeed,
  formatSemitoneShift,
  formatSpeed,
  shortestSemitones,
} from './semitones';

describe('formato de gravação por navegador', () => {
  const supports = (types: string[]) => (t: string) => types.includes(t);

  it('Chrome/Android: WebM com Opus a 32 kbps', () => {
    expect(chooseRecordingFormat(supports(['audio/webm;codecs=opus', 'audio/webm']))).toEqual({
      mimeType: 'audio/webm;codecs=opus',
      extension: 'webm',
      bitsPerSecond: 32_000,
    });
  });

  it('Safari/iPhone: MP4/AAC com bitrate baixo', () => {
    const f = chooseRecordingFormat(supports(['audio/mp4', 'audio/mp4;codecs=mp4a.40.2']));
    expect(f?.mimeType).toBe('audio/mp4;codecs=mp4a.40.2');
    expect(f?.extension).toBe('m4a');
    expect(f?.bitsPerSecond).toBeLessThanOrEqual(64_000);
  });

  it('Safari antigo só com "audio/mp4"', () => {
    expect(chooseRecordingFormat(supports(['audio/mp4']))?.mimeType).toBe('audio/mp4');
  });

  it('Firefox antigo: Ogg/Opus', () => {
    expect(chooseRecordingFormat(supports(['audio/ogg;codecs=opus']))?.extension).toBe('ogg');
  });

  it('sem suporte: null', () => {
    expect(chooseRecordingFormat(() => false)).toBeNull();
  });

  it('tipo sem codecs e extensão de arquivo enviado', () => {
    expect(baseMimeType('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(extensionFor('audio/mpeg')).toBe('mp3');
    expect(extensionFor('audio/x-m4a')).toBe('m4a');
    expect(extensionFor('', 'ensaio.WAV')).toBe('wav');
  });
});

describe('limites', () => {
  it('limite de 45 MB por arquivo (abaixo dos 50 MB do plano grátis)', () => {
    expect(MAX_AUDIO_BYTES).toBe(47_185_920);
    expect(MAX_AUDIO_BYTES).toBeLessThan(50 * 1024 * 1024);
  });

  it('arquivo escolhido para envio', () => {
    expect(audioFileProblem({ size: 1000, type: 'audio/mpeg', name: 'a.mp3' })).toBeNull();
    expect(audioFileProblem({ size: 1000, type: '', name: 'a.m4a' })).toBeNull();
    expect(audioFileProblem({ size: 1000, type: 'video/mp4', name: 'a.mp4' })).toMatch(
      /arquivo de áudio/,
    );
    expect(audioFileProblem({ size: 0, type: 'audio/wav', name: 'a.wav' })).toMatch(/vazio/);
    expect(
      audioFileProblem({ size: MAX_AUDIO_BYTES + 1, type: 'audio/wav', name: 'a.wav' }),
    ).toMatch(/o limite é 45 MB/);
    expect(
      audioFileProblem({ size: MAX_AUDIO_BYTES, type: 'audio/wav', name: 'a.wav' }),
    ).toBeNull();
  });

  it('aviso antes de passar de 45 MB durante a gravação', () => {
    expect(recordingSizeLevel(WARN_AUDIO_BYTES - 1)).toBe('ok');
    expect(recordingSizeLevel(WARN_AUDIO_BYTES)).toBe('warn');
    expect(recordingSizeLevel(STOP_AUDIO_BYTES)).toBe('stop');
    expect(STOP_AUDIO_BYTES).toBeLessThan(MAX_AUDIO_BYTES);
  });

  it('quanto tempo cabe', () => {
    expect(minutesThatFit(32_000)).toBe(196); // ~3 h a 32 kbps
    expect(minutesThatFit(48_000)).toBe(131); // ~2 h a 48 kbps
  });

  it('formatação', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(MAX_AUDIO_BYTES)).toBe('45 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3723)).toBe('1:02:03');
  });
});

describe('semitons entre tons (áudio acompanha a cifra)', () => {
  it('caminho mais curto, entre −6 e +5', () => {
    expect(shortestSemitones('G', 'A')).toBe(2);
    expect(shortestSemitones('G', 'F')).toBe(-2);
    expect(shortestSemitones('C', 'F#')).toBe(-6);
    expect(shortestSemitones('C', 'F')).toBe(5);
    expect(shortestSemitones('D', 'D')).toBe(0);
    expect(shortestSemitones('Bb', 'A#')).toBe(0);
    expect(shortestSemitones('Em', 'Gm')).toBe(3);
  });

  it('sem tom (ou tom inválido): null', () => {
    expect(shortestSemitones(null, 'G')).toBeNull();
    expect(shortestSemitones('G', 'H')).toBeNull();
  });

  it('limites dos controles', () => {
    expect(clampPitch(9)).toBe(6);
    expect(clampPitch(-2.4)).toBe(-2);
    expect(clampSpeed(0.3)).toBe(0.5);
    expect(clampSpeed(1.4)).toBe(1);
    expect(clampSpeed(0.77)).toBe(0.75);
    expect(formatSemitoneShift(-3)).toBe('−3');
    expect(formatSemitoneShift(2)).toBe('+2');
    expect(formatSpeed(0.75)).toBe('75%');
  });
});
