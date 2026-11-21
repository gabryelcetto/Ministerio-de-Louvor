// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** localStorage bloqueado (aba anônima / dados do site bloqueados): toda chamada lança erro. */
const blockedStorage = {
  getItem: () => {
    throw new Error('bloqueado');
  },
  setItem: () => {
    throw new Error('bloqueado');
  },
  removeItem: () => {
    throw new Error('bloqueado');
  },
};
afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

/** Janela de mentira com os eventos do PWA. */
function fakeWindow(opts: { standalone?: boolean; displayStandalone?: boolean; ua?: string } = {}) {
  const target = new EventTarget();
  return Object.assign(target, {
    navigator: {
      userAgent: opts.ua ?? 'Mozilla/5.0 (Linux; Android 15)',
      platform: 'Linux',
      maxTouchPoints: 5,
      standalone: opts.standalone,
    },
    matchMedia: () => ({ matches: opts.displayStandalone ?? false }),
  }) as unknown as Window;
}

function installEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  return Object.assign(event, {
    prompt: vi.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome }),
  });
}

describe('instalação do app (estado e eventos do navegador)', () => {
  it('começa pelo estado do aparelho e avisa quem está ouvindo', async () => {
    const install = await import('./install');
    const win = fakeWindow();
    install.initInstallCapture(win);
    expect(install.getInstallState()).toEqual({
      canPrompt: false,
      installed: false,
      platform: 'android',
    });

    const listener = vi.fn();
    const unsubscribe = install.subscribeInstallState(listener);
    const event = installEvent('accepted');
    win.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); // o app decide quando oferecer
    expect(install.getInstallState().canPrompt).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    win.dispatchEvent(new Event('appinstalled'));
    expect(install.getInstallState()).toMatchObject({ canPrompt: false, installed: true });
    expect(listener).toHaveBeenCalledTimes(1); // já tinha saído
  });

  it('promptInstall: sem evento não faz nada; aceito marca instalado; usa o evento uma vez', async () => {
    const install = await import('./install');
    expect(await install.promptInstall()).toBe(false);

    const win = fakeWindow();
    install.initInstallCapture(win);
    const event = installEvent('accepted');
    win.dispatchEvent(event);
    expect(await install.promptInstall()).toBe(true);
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(install.getInstallState()).toMatchObject({ canPrompt: false, installed: true });
    expect(await install.promptInstall()).toBe(false); // evento já usado
  });

  it('recusou: continua não instalado', async () => {
    const install = await import('./install');
    const win = fakeWindow();
    install.initInstallCapture(win);
    win.dispatchEvent(installEvent('dismissed'));
    expect(await install.promptInstall()).toBe(false);
    expect(install.getInstallState()).toMatchObject({ canPrompt: false, installed: false });
  });

  it('já aberto como app (iPhone ou display-mode standalone)', async () => {
    const { isStandalone } = await import('./install');
    expect(isStandalone(fakeWindow({ standalone: true }))).toBe(true);
    expect(isStandalone(fakeWindow({ displayStandalone: true }))).toBe(true);
    expect(isStandalone(fakeWindow())).toBe(false);
    const semMatchMedia = Object.assign(fakeWindow(), { matchMedia: undefined });
    expect(isStandalone(semMatchMedia)).toBe(false);
    // Padrão: a janela de verdade (happy-dom não está instalado)
    expect(isStandalone()).toBe(false);
  });

  it('aviso de instalar dispensado fica guardado; sem armazenamento não quebra', async () => {
    const install = await import('./install');
    expect(install.isInstallTipDismissed()).toBe(false);
    install.dismissInstallTip();
    expect(install.isInstallTipDismissed()).toBe(true);

    vi.stubGlobal('localStorage', blockedStorage);
    expect(install.isInstallTipDismissed()).toBe(false);
    expect(() => install.dismissInstallTip()).not.toThrow();
  });

  it('initInstallCapture sem argumento usa a janela do navegador', async () => {
    const install = await import('./install');
    install.initInstallCapture();
    expect(install.getInstallState().installed).toBe(false);
  });
});
