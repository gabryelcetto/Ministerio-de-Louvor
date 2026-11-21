/**
 * Instalação do PWA.
 * - Android/Chrome (e Edge no computador): o navegador dispara `beforeinstallprompt`; guardamos o
 *   evento e o botão "Instalar app" chama `prompt()`.
 * - iPhone/iPad: não há esse evento; a pessoa instala pelo menu Compartilhar do Safari
 *   (tela /instalar com o passo a passo).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Platform = 'ios' | 'android' | 'other';

export interface InstallState {
  /** O navegador ofereceu a instalação e o botão pode abri-la. */
  canPrompt: boolean;
  /** Já está rodando como app instalado (ou acabou de ser instalado). */
  installed: boolean;
  platform: Platform;
}

/** iPadOS se apresenta como Mac; a tela de toque denuncia. */
export function detectPlatform(userAgent: string, platform = '', maxTouchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (platform === 'MacIntel' && maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'other';
}

export function isStandalone(win: Window = window): boolean {
  const iosStandalone = (win.navigator as Navigator & { standalone?: boolean }).standalone;
  return Boolean(iosStandalone) || win.matchMedia?.('(display-mode: standalone)').matches === true;
}

let deferred: BeforeInstallPromptEvent | null = null;
let state: InstallState = { canPrompt: false, installed: false, platform: 'other' };
const listeners = new Set<() => void>();

function setState(patch: Partial<InstallState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

/** Chamar uma vez, o mais cedo possível (main.tsx): o evento pode vir antes de qualquer tela. */
export function initInstallCapture(win: Window = window): void {
  state = {
    canPrompt: false,
    installed: isStandalone(win),
    platform: detectPlatform(
      win.navigator.userAgent,
      win.navigator.platform,
      win.navigator.maxTouchPoints,
    ),
  };
  win.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // não mostra a faixa automática; o app oferece no momento certo
    deferred = event as BeforeInstallPromptEvent;
    setState({ canPrompt: true });
  });
  win.addEventListener('appinstalled', () => {
    deferred = null;
    setState({ canPrompt: false, installed: true });
  });
}

/** Abre a janela de instalação do navegador. Devolve true se a pessoa aceitou. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  // O evento só pode ser usado uma vez.
  deferred = null;
  setState({ canPrompt: false, installed: outcome === 'accepted' || state.installed });
  return outcome === 'accepted';
}

/** Avisa quando o estado da instalação muda (para o hook useInstallState). */
export function subscribeInstallState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallState(): InstallState {
  return state;
}

/** O aviso no Início faz sentido? Só se ainda não instalou e há um caminho para instalar. */
export function shouldOfferInstall(s: InstallState): boolean {
  return !s.installed && (s.canPrompt || s.platform === 'ios');
}

const DISMISS_KEY = 'aviso-instalar-dispensado';

export function isInstallTipDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissInstallTip(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Sem armazenamento: o aviso some só nesta visita.
  }
}
