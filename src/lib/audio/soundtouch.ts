/**
 * Mudança de tom e de velocidade no próprio aparelho (sem servidor), com SoundTouch rodando
 * num AudioWorklet (@soundtouchjs/audio-worklet, licença MPL-2.0).
 *
 * Como funciona (recomendação da própria biblioteca):
 * - a VELOCIDADE vem do `playbackRate` do <audio> (o navegador lê o arquivo mais rápido/devagar);
 * - o SoundTouch recebe o mesmo `playbackRate` e corrige a altura, e aplica o TOM pedido em
 *   semitons. Resultado: tom e andamento independentes.
 * O <audio> continua tocando o arquivo em fluxo (não decodifica tudo na memória), o que importa
 * para gravações de ensaio longas.
 */
import processorUrl from '@soundtouchjs/audio-worklet/processor?url';

/**
 * A biblioteca faz `class SoundTouchNode extends AudioWorkletNode` ao ser carregada: num navegador
 * sem AudioWorklet isso quebraria o app inteiro na abertura. Por isso ela só é carregada aqui,
 * na primeira vez que alguém toca um áudio (e só se o navegador suportar).
 */
const loadSoundTouch = () => import('@soundtouchjs/audio-worklet');

let context: AudioContext | null = null;
let registered: Promise<void> | null = null;

export function isSoundTouchSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.AudioContext === 'function' &&
    typeof AudioWorkletNode === 'function'
  );
}

async function getContext(): Promise<AudioContext> {
  const { SoundTouchNode } = await loadSoundTouch();
  context ??= new AudioContext();
  registered ??= SoundTouchNode.register(context, processorUrl).catch((error: unknown) => {
    registered = null;
    throw error;
  });
  await registered;
  if (context.state === 'suspended') await context.resume();
  return context;
}

export interface PitchChain {
  setSpeed(speed: number): void;
  setSemitones(semitones: number): void;
}

/** Um <audio> só pode ser ligado ao Web Audio uma vez: guardamos a ligação por elemento. */
const chains = new WeakMap<HTMLAudioElement, PitchChain>();

/**
 * Liga o <audio> ao SoundTouch (na primeira vez que for tocar: o navegador só libera o áudio
 * depois de um toque do usuário).
 */
export async function attachSoundTouch(audio: HTMLAudioElement): Promise<PitchChain> {
  const existing = chains.get(audio);
  if (existing) return existing;
  const ctx = await getContext();
  const { SoundTouchNode } = await loadSoundTouch();
  const node = new SoundTouchNode({ context: ctx });
  const source = ctx.createMediaElementSource(audio);
  source.connect(node);
  node.connect(ctx.destination);
  // O SoundTouch corrige a altura; o navegador não deve corrigir de novo.
  audio.preservesPitch = false;

  const chain: PitchChain = {
    setSpeed(speed) {
      audio.playbackRate = speed;
      node.playbackRate.value = speed;
    },
    setSemitones(semitones) {
      node.pitchSemitones.value = semitones;
    },
  };
  chains.set(audio, chain);
  return chain;
}
