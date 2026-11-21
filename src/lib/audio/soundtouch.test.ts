import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const register = vi.fn<(ctx: unknown, url: string) => Promise<void>>();
const nodes: FakeNode[] = [];

class FakeNode {
  playbackRate = { value: 1 };
  pitchSemitones = { value: 0 };
  connect = vi.fn();
  constructor(readonly options: { context: unknown }) {
    nodes.push(this);
  }
  static register = register;
}

vi.mock('@soundtouchjs/audio-worklet', () => ({ SoundTouchNode: FakeNode }));
vi.mock('@soundtouchjs/audio-worklet/processor?url', () => ({ default: '/processador.js' }));

class FakeContext {
  static created = 0;
  state = 'suspended';
  destination = { nome: 'saida' };
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  createMediaElementSource = vi.fn(() => ({ connect: vi.fn() }));
  constructor() {
    FakeContext.created++;
  }
}

beforeEach(() => {
  vi.resetModules();
  nodes.length = 0;
  FakeContext.created = 0;
  register.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

const audio = () => ({ playbackRate: 1, preservesPitch: true }) as unknown as HTMLAudioElement;

describe('SoundTouch (tom e velocidade no aparelho)', () => {
  it('só é suportado com AudioContext e AudioWorkletNode', async () => {
    const { isSoundTouchSupported } = await import('./soundtouch');
    expect(isSoundTouchSupported()).toBe(false); // node: sem window
    vi.stubGlobal('window', { AudioContext: FakeContext });
    expect(isSoundTouchSupported()).toBe(false); // sem AudioWorkletNode
    vi.stubGlobal('AudioWorkletNode', function AudioWorkletNode() {});
    expect(isSoundTouchSupported()).toBe(true);
    vi.stubGlobal('window', { AudioContext: 'não é função' });
    expect(isSoundTouchSupported()).toBe(false);
  });

  it('liga o <audio> uma vez só, registra o processador e aplica velocidade e tom', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const { attachSoundTouch } = await import('./soundtouch');
    const el = audio();

    const chain = await attachSoundTouch(el);
    expect(register).toHaveBeenCalledWith(expect.any(FakeContext), '/processador.js');
    expect(el.preservesPitch).toBe(false);
    const node = nodes[0]!;
    const ctx = node.options.context as FakeContext;
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.createMediaElementSource).toHaveBeenCalledWith(el);
    expect(node.connect).toHaveBeenCalledWith(ctx.destination);

    chain.setSpeed(0.75);
    expect(el.playbackRate).toBe(0.75);
    expect(node.playbackRate.value).toBe(0.75);
    chain.setSemitones(-2);
    expect(node.pitchSemitones.value).toBe(-2);

    // Mesmo elemento: devolve a mesma ligação (o navegador não deixa ligar duas vezes).
    expect(await attachSoundTouch(el)).toBe(chain);
    // Outro elemento: reaproveita o mesmo AudioContext e o registro.
    await attachSoundTouch(audio());
    expect(FakeContext.created).toBe(1);
    expect(register).toHaveBeenCalledTimes(1);
    expect(nodes).toHaveLength(2);
  });

  it('contexto já rodando não chama resume', async () => {
    class Running extends FakeContext {
      override state = 'running';
    }
    vi.stubGlobal('AudioContext', Running);
    const { attachSoundTouch } = await import('./soundtouch');
    await attachSoundTouch(audio());
    expect((nodes[0]!.options.context as FakeContext).resume).not.toHaveBeenCalled();
  });

  it('se o registro falhar, a próxima tentativa registra de novo', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    register.mockRejectedValueOnce(new Error('sem rede'));
    const { attachSoundTouch } = await import('./soundtouch');
    await expect(attachSoundTouch(audio())).rejects.toThrow('sem rede');
    await expect(attachSoundTouch(audio())).resolves.toBeDefined();
    expect(register).toHaveBeenCalledTimes(2);
  });
});
