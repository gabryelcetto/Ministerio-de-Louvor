import { useCallback, useEffect, useRef, useState } from 'react';
import { chooseRecordingFormat } from '@/lib/audio/format';
import { recordingSizeLevel, type RecordingSizeLevel } from '@/lib/audio/limits';
import {
  appendChunk,
  saveSession,
  type RecordingSession,
  type RecordingTarget,
} from '@/lib/audio/recording-store';

export type RecorderState = 'idle' | 'starting' | 'recording' | 'paused' | 'stopping';

/** A cada quantos ms o MediaRecorder entrega um pedaço (que vai na hora para o IndexedDB). */
const CHUNK_MS = 5000;

const now = () => performance.now();

/** Tempo gravado: acumulado + trecho atual (a pausa congela o cronômetro). */
function elapsedFrom(accumulated: number, segmentStart: number | null): number {
  return accumulated + (segmentStart === null ? 0 : now() - segmentStart);
}

interface WakeLockLike {
  release(): Promise<void>;
}

/**
 * Gravação de áudio (ensaio ou referência da música):
 * - áudio comprimido (Opus/AAC com bitrate baixo, conforme o navegador);
 * - pedaços salvos no IndexedDB enquanto grava (fechou o app? a gravação continua lá);
 * - cronômetro que respeita pausa; Wake Lock para a tela não apagar;
 * - aviso perto de 45 MB e parada automática antes do limite.
 */
export function useRecorder(
  target: RecordingTarget,
  onStopped: (session: RecordingSession) => void,
) {
  const { kind, targetId } = target;
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [autoStopped, setAutoStopped] = useState(false);
  const [wakeLockOn, setWakeLockOn] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<RecordingSession | null>(null);
  const seqRef = useRef(0);
  const writesRef = useRef<Promise<void>>(Promise.resolve());
  const wakeLockRef = useRef<WakeLockLike | null>(null);
  // Cronômetro: tempo acumulado + início do trecho atual (pausa congela).
  const accumulatedRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);

  const requestWakeLock = useCallback(async () => {
    const wl = (
      navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<WakeLockLike> } }
    ).wakeLock;
    if (!wl) return;
    try {
      wakeLockRef.current = await wl.request('screen');
      setWakeLockOn(true);
    } catch {
      setWakeLockOn(false); // sem permissão / economia de bateria: grava do mesmo jeito
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    void wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
    setWakeLockOn(false);
  }, []);

  // O navegador solta o Wake Lock quando a aba sai de foco: pede de novo ao voltar.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && recorderRef.current?.state === 'recording') {
        void requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [requestWakeLock]);

  // Atualiza o cronômetro na tela.
  useEffect(() => {
    if (state !== 'recording') return;
    const timer = window.setInterval(
      () => setElapsedMs(elapsedFrom(accumulatedRef.current, segmentStartRef.current)),
      500,
    );
    return () => window.clearInterval(timer);
  }, [state]);

  // Avisa antes de fechar a aba durante a gravação (os pedaços já estão salvos, mas a gravação para).
  useEffect(() => {
    if (state !== 'recording' && state !== 'paused') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    setState('stopping');
    if (segmentStartRef.current !== null) {
      accumulatedRef.current += now() - segmentStartRef.current;
      segmentStartRef.current = null;
    }
    recorder.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setAutoStopped(false);
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError(
        'Este navegador não grava áudio. Use o Chrome (Android) ou o Safari (iPhone) atualizados.',
      );
      return;
    }
    const format = chooseRecordingFormat((t) => MediaRecorder.isTypeSupported(t));
    if (!format) {
      setError('Este navegador não grava áudio comprimido.');
      return;
    }
    setState('starting');
    let stream: MediaStream;
    try {
      // Música em sala: sem cancelamento de eco nem supressão de ruído (cortam instrumentos).
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
    } catch {
      setState('idle');
      setError('Sem acesso ao microfone. Libere o microfone para este site nas configurações.');
      return;
    }
    streamRef.current = stream;
    const recorder = new MediaRecorder(stream, {
      mimeType: format.mimeType,
      audioBitsPerSecond: format.bitsPerSecond,
    });
    recorderRef.current = recorder;
    seqRef.current = 0;
    accumulatedRef.current = 0;
    segmentStartRef.current = now();
    setElapsedMs(0);
    setBytes(0);

    const session: RecordingSession = {
      id: crypto.randomUUID(),
      kind,
      targetId,
      // O tipo real pode vir sem "codecs": usamos o do gravador.
      mimeType: recorder.mimeType || format.mimeType,
      extension: format.extension,
      startedAt: new Date().toISOString(),
      durationMs: 0,
      bytes: 0,
      status: 'recording',
    };
    sessionRef.current = session;
    await saveSession(session);

    recorder.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0 || !sessionRef.current) return;
      const updated: RecordingSession = {
        ...sessionRef.current,
        bytes: sessionRef.current.bytes + e.data.size,
        durationMs: elapsedFrom(accumulatedRef.current, segmentStartRef.current),
      };
      sessionRef.current = updated;
      setBytes(updated.bytes);
      const seq = seqRef.current++;
      writesRef.current = writesRef.current.then(() => appendChunk(updated, seq, e.data));
      if (recordingSizeLevel(updated.bytes) === 'stop' && recorder.state !== 'inactive') {
        setAutoStopped(true);
        stop();
      }
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      releaseWakeLock();
      const finished: RecordingSession = {
        ...(sessionRef.current as RecordingSession),
        durationMs: accumulatedRef.current,
        status: 'stopped',
      };
      sessionRef.current = null;
      recorderRef.current = null;
      // Espera os pedaços terminarem de gravar antes de entregar a sessão.
      writesRef.current = writesRef.current
        .then(() => saveSession(finished))
        .then(() => {
          setState('idle');
          onStopped(finished);
        })
        .catch(() => {
          setState('idle');
          setError('A gravação terminou, mas não foi possível salvar no aparelho.');
        });
    };
    recorder.onerror = () => {
      setError('O gravador parou com erro. O que já foi gravado está salvo no aparelho.');
      stop();
    };

    recorder.start(CHUNK_MS);
    setState('recording');
    void requestWakeLock();
  }, [kind, targetId, onStopped, releaseWakeLock, requestWakeLock, stop]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state !== 'recording') return;
    recorder.pause();
    if (segmentStartRef.current !== null) {
      accumulatedRef.current += now() - segmentStartRef.current;
      segmentStartRef.current = null;
    }
    setElapsedMs(accumulatedRef.current);
    setState('paused');
  }, []);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state !== 'paused') return;
    recorder.resume();
    segmentStartRef.current = now();
    setState('recording');
  }, []);

  // Saiu da tela gravando: para e guarda (os pedaços já estão no IndexedDB).
  useEffect(
    () => () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive')
        recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const level: RecordingSizeLevel = recordingSizeLevel(bytes);
  return {
    state,
    elapsedMs,
    bytes,
    level,
    error,
    autoStopped,
    wakeLockOn,
    start,
    pause,
    resume,
    stop,
  };
}
