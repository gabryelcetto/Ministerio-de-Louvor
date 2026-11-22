// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PushSettings } from './push-settings';

const api = vi.hoisted(() => ({
  availability: 'available' as string,
  subscribed: false,
  enablePush: vi.fn(),
  disablePush: vi.fn(),
}));
vi.mock('../push-api', () => ({
  currentPushAvailability: () => api.availability,
  getPushSubscription: () => Promise.resolve(api.subscribed ? {} : null),
  enablePush: api.enablePush,
  disablePush: api.disablePush,
}));

beforeEach(() => {
  api.availability = 'available';
  api.subscribed = false;
  api.enablePush.mockReset().mockResolvedValue(undefined);
  api.disablePush.mockReset().mockResolvedValue(undefined);
});

describe('Receber avisos no celular', () => {
  it('sem chave VAPID: a opção não aparece', () => {
    api.availability = 'hidden';
    const { container } = render(<PushSettings />);
    expect(container.innerHTML).toBe('');
  });

  it('iPhone fora da tela inicial: explica como instalar (iOS 16.4+)', () => {
    api.availability = 'ios-install';
    render(<PushSettings />);
    expect(screen.getByText(/instalado na tela inicial \(iOS 16\.4/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('navegador sem suporte', () => {
    api.availability = 'unsupported';
    render(<PushSettings />);
    expect(screen.getByText(/Este navegador não recebe avisos/)).toBeTruthy();
  });

  it('ativa e desativa neste aparelho', async () => {
    const user = userEvent.setup();
    render(<PushSettings />);
    expect(await screen.findByText('Desativado neste aparelho.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Receber avisos' }));
    expect(await screen.findByText('Ativado neste aparelho.')).toBeTruthy();
    expect(api.enablePush).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Parar de receber' }));
    await waitFor(() => expect(api.disablePush).toHaveBeenCalledOnce());
    expect(await screen.findByText('Desativado neste aparelho.')).toBeTruthy();
  });

  it('permissão negada: mostra o motivo', async () => {
    api.enablePush.mockRejectedValue(new Error('O celular não deu permissão para avisos.'));
    const user = userEvent.setup();
    render(<PushSettings />);
    await user.click(await screen.findByRole('button', { name: 'Receber avisos' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Desativado neste aparelho.')).toBeTruthy();
  });
});
