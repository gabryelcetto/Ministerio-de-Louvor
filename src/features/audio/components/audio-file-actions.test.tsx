// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REHEARSAL_ID, SONG_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));
vi.mock('@/lib/audio/soundtouch', () => ({
  isSoundTouchSupported: () => false,
  attachSoundTouch: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

describe('baixar e compartilhar áudios', () => {
  it('áudio de referência: "Baixar" usa o link assinado com o nome da música e do áudio', async () => {
    const hrefs: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      hrefs.push(`${this.download}|${this.href}`);
    });
    const { user } = renderApp(`/repertorio/${SONG_ID}`, { as: 'member' });
    await findHeading('Grande é o Senhor');
    await user.click(await screen.findByRole('button', { name: /Baixar.*Voz guia/ }));
    await waitFor(() => expect(hrefs).toHaveLength(1));
    const [name, href] = hrefs[0]!.split('|');
    expect(name).toBe('Grande é o Senhor - Voz guia.mp3');
    expect(href).toContain('download=');
    expect(decodeURIComponent(href!)).toContain('Grande é o Senhor - Voz guia.mp3');
  });

  it('sem compartilhar arquivo: copia o link (vale por 1 hora)', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const { user } = renderApp(`/repertorio/${SONG_ID}`, { as: 'member' });
    await findHeading('Grande é o Senhor');
    await user.click(await screen.findByRole('button', { name: /Compartilhar.*Voz guia/ }));
    expect(await screen.findByText('Link copiado. Ele vale por 1 hora.')).toBeTruthy();
    expect(writeText.mock.calls[0]![0]).toContain('voz.mp3');
  });

  it('com Web Share de arquivo: manda o arquivo com o nome legível', async () => {
    const shared: File[] = [];
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', {
      value: (data: { files: File[] }) => {
        shared.push(...data.files);
        return Promise.resolve();
      },
      configurable: true,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['abc']))));
    const { user } = renderApp(`/repertorio/${SONG_ID}`, { as: 'member' });
    await findHeading('Grande é o Senhor');
    await user.click(await screen.findByRole('button', { name: /Compartilhar.*Voz guia/ }));
    await waitFor(() => expect(shared).toHaveLength(1));
    expect(shared[0]!.name).toBe('Grande é o Senhor - Voz guia.mp3');
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'canShare');
    Reflect.deleteProperty(navigator, 'share');
  });

  it('gravação de ensaio sem nome: "Ensaio DD-MM - Parte N"', async () => {
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    const { user } = renderApp(`/escalas/${REHEARSAL_ID}`, {
      as: 'member',
      setup: (s) => {
        const ref = s.tables!.media_files![0]!;
        s.tables!.media_files!.push({
          ...ref,
          id: 'm-ensaio',
          kind: 'rehearsal',
          song_id: null,
          event_id: REHEARSAL_ID,
          label: null,
          mime_type: 'audio/webm',
          storage_path: `rehearsal/${REHEARSAL_ID}/a.webm`,
        });
      },
    });
    await screen.findByRole('heading', { name: 'Gravações deste ensaio' });
    await user.click(await screen.findByRole('button', { name: /^Baixar/ }));
    await waitFor(() => expect(names).toHaveLength(1));
    expect(names[0]).toMatch(/^Ensaio \d{2}-\d{2} - Parte 1\.webm$/);
  });
});
