// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const chain = { setSpeed: vi.fn(), setSemitones: vi.fn() };
const soundtouch = vi.hoisted(() => ({
  supported: true,
  attach: vi.fn(),
}));
vi.mock('@/lib/audio/soundtouch', () => ({
  isSoundTouchSupported: () => soundtouch.supported,
  attachSoundTouch: soundtouch.attach,
}));

const { AudioPlayer } = await import('./audio-player');

beforeEach(() => {
  soundtouch.supported = true;
  soundtouch.attach.mockReset().mockResolvedValue(chain);
  chain.setSpeed.mockReset();
  chain.setSemitones.mockReset();
  // happy-dom não toca áudio: play/pause só mudam o estado "paused".
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get(this: HTMLMediaElement & { _playing?: boolean }) {
      return !this._playing;
    },
  });
  HTMLMediaElement.prototype.play = vi.fn(async function (
    this: HTMLMediaElement & { _playing?: boolean },
  ) {
    this._playing = true;
    this.dispatchEvent(new Event('play'));
  });
  HTMLMediaElement.prototype.pause = vi.fn(function (
    this: HTMLMediaElement & { _playing?: boolean },
  ) {
    this._playing = false;
    this.dispatchEvent(new Event('pause'));
  });
});

const player = () => screen.getByTestId('audio-player');

describe('player de áudio (tom e velocidade)', () => {
  it('toca com SoundTouch, ajusta velocidade e tom à mão', async () => {
    const user = userEvent.setup();
    render(<AudioPlayer src="https://x/a.mp3" label="Voz guia" durationSeconds={125} />);
    expect(player().dataset.engine).toBe('parado');
    await user.click(screen.getByRole('button', { name: 'Tocar Voz guia' }));
    await waitFor(() => expect(player().dataset.engine).toBe('soundtouch'));
    expect(screen.getByRole('button', { name: 'Pausar Voz guia' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '75%' }));
    expect(player().dataset.speed).toBe('0.75');
    expect(chain.setSpeed).toHaveBeenLastCalledWith(0.75);
    await user.click(screen.getByRole('button', { name: 'Diminuir velocidade' }));
    await user.click(screen.getByRole('button', { name: 'Aumentar velocidade' }));
    await user.click(screen.getByRole('button', { name: 'Aumentar velocidade' }));

    await user.click(screen.getByRole('button', { name: 'Subir meio tom do áudio' }));
    await user.click(screen.getByRole('button', { name: 'Subir meio tom do áudio' }));
    await user.click(screen.getByRole('button', { name: 'Descer meio tom do áudio' }));
    expect(player().dataset.pitch).toBe('1');
    expect(chain.setSemitones).toHaveBeenLastCalledWith(1);

    await user.click(screen.getByRole('button', { name: 'Avançar 10 segundos' }));
    await user.click(screen.getByRole('button', { name: 'Voltar 10 segundos' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Posição em Voz guia' }), {
      target: { value: '30' },
    });
    await user.click(screen.getByRole('button', { name: 'Pausar Voz guia' }));
    expect(screen.getByRole('button', { name: 'Tocar Voz guia' })).toBeTruthy();
  });

  it('tom acompanha a cifra; desmarcar passa para ajuste manual', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <AudioPlayer
        src="x"
        label="A"
        durationSeconds={null}
        followSemitones={2}
        followLabel="A: +2"
      />,
    );
    expect(player().dataset.pitch).toBe('2');
    rerender(
      <AudioPlayer
        src="x"
        label="A"
        durationSeconds={null}
        followSemitones={3}
        followLabel="A: +3"
      />,
    );
    expect(player().dataset.pitch).toBe('3');
    const follow = screen.getByRole('checkbox', { name: /Acompanhar o tom da cifra \(A: \+3\)/ });
    await user.click(follow);
    expect((follow as HTMLInputElement).checked).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Subir meio tom do áudio' }));
    expect(player().dataset.pitch).toBe('4');
  });

  it('navegador sem AudioWorklet: toca no modo nativo e trava o tom', async () => {
    soundtouch.supported = false;
    const user = userEvent.setup();
    render(<AudioPlayer src="x" label="B" durationSeconds={10} />);
    await user.click(screen.getByRole('button', { name: 'Tocar B' }));
    await waitFor(() => expect(player().dataset.engine).toBe('nativo'));
    expect(soundtouch.attach).not.toHaveBeenCalled();
  });

  it('SoundTouch falhou: avisa e segue com a velocidade', async () => {
    soundtouch.attach.mockRejectedValueOnce(new Error('worklet'));
    const user = userEvent.setup();
    render(<AudioPlayer src="x" label="C" durationSeconds={10} />);
    await user.click(screen.getByRole('button', { name: 'Tocar C' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Mudar o tom não funciona neste navegador; a velocidade continua disponível.',
    );
  });

  it('arquivo que não toca mostra erro', async () => {
    HTMLMediaElement.prototype.play = vi.fn(async () => {
      throw new Error('NotSupportedError');
    });
    const user = userEvent.setup();
    render(<AudioPlayer src="x" label="D" durationSeconds={10} />);
    await user.click(screen.getByRole('button', { name: 'Tocar D' }));
    expect(await screen.findByText('Não foi possível tocar este áudio.')).toBeTruthy();
  });

  it('atualiza tempo e duração pelos eventos do <audio>', () => {
    render(<AudioPlayer src="x" label="E" durationSeconds={null} />);
    const audio = player().querySelector('audio')!;
    Object.defineProperty(audio, 'duration', { configurable: true, value: 200 });
    fireEvent(audio, new Event('loadedmetadata'));
    Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 65 });
    fireEvent(audio, new Event('timeupdate'));
    fireEvent(audio, new Event('ended'));
    expect(player().textContent).toContain('1:05');
  });
});
