// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText, downloadBlob, shareFile, shareText } from './browser-share';

afterEach(() => vi.useRealTimers());

const abort = () => Object.assign(new Error('cancelou'), { name: 'AbortError' });

describe('compartilhar com plano B', () => {
  it('usa o menu do celular quando existe', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await shareText({ title: 'T', text: 'x' }, { navigator: { share } })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'T', text: 'x' });
  });

  it('cancelar no menu não abre o WhatsApp', async () => {
    const open = vi.fn();
    const share = vi.fn().mockRejectedValue(abort());
    expect(await shareText({ title: 'T', text: 'x' }, { navigator: { share }, open })).toBe(
      'cancelled',
    );
    expect(open).not.toHaveBeenCalled();
  });

  it('sem Web Share: copia o texto e abre o WhatsApp', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn();
    const out = await shareText(
      { title: 'T', text: 'Culto 19h' },
      { navigator: { clipboard: { writeText } as unknown as Clipboard }, open },
    );
    expect(out).toBe('copied-whatsapp');
    expect(writeText).toHaveBeenCalledWith('Culto 19h');
    expect(open).toHaveBeenCalledWith(
      'https://wa.me/?text=Culto%2019h',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('Web Share com erro, sem área de transferência: abre o WhatsApp mesmo assim', async () => {
    const open = vi.fn();
    const share = vi.fn().mockRejectedValue(new Error('falhou'));
    expect(await shareText({ title: 'T', text: 'x' }, { navigator: { share }, open })).toBe(
      'failed',
    );
    expect(open).toHaveBeenCalled();
  });

  it('sem janela: só copia (ou falha)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(
      await shareText(
        { title: 'T', text: 'x' },
        { navigator: { clipboard: { writeText } as unknown as Clipboard } },
      ),
    ).toBe('copied');
    const broken = vi.fn().mockRejectedValue(new Error('negado'));
    expect(
      await shareText(
        { title: 'T', text: 'x' },
        { navigator: { clipboard: { writeText: broken } as unknown as Clipboard } },
      ),
    ).toBe('failed');
    expect(await copyText('x', {})).toBe(false);
  });

  it('arquivo: compartilha quando o aparelho aceita; senão devolve null', async () => {
    const file = new File(['a'], 'a.webm', { type: 'audio/webm' });
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await shareFile(file, 'Áudio', { navigator: { share, canShare: () => true } })).toBe(
      'shared',
    );
    expect(
      await shareFile(file, 'Áudio', { navigator: { share, canShare: () => false } }),
    ).toBeNull();
    expect(await shareFile(file, 'Áudio', {})).toBeNull();
    const cancelled = vi.fn().mockRejectedValue(abort());
    expect(
      await shareFile(file, 'Áudio', { navigator: { share: cancelled, canShare: () => true } }),
    ).toBe('cancelled');
    const failing = vi.fn().mockRejectedValue(new Error('x'));
    expect(
      await shareFile(file, 'Áudio', { navigator: { share: failing, canShare: () => true } }),
    ).toBeNull();
  });

  it('baixa o arquivo gerado e libera a URL depois', () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clicked: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(`${this.download}|${this.href}`);
    });
    downloadBlob(new Blob(['BEGIN']), 'culto.ics');
    expect(clicked).toEqual(['culto.ics|blob:x']);
    expect(document.querySelector('a[download]')).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith('blob:x');
    create.mockRestore();
    revoke.mockRestore();
    click.mockRestore();
  });
});
