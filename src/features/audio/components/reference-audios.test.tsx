// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeMediaRecorder, FakeUploadXhr, installBrowserFakes } from '@/test/browser-fakes';
import { fake } from '@/test/fake-supabase';
import { MEMBER_ID, REHEARSAL_ID, SONG2_ID, SONG_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render-app';
import { ReferenceAudios } from './reference-audios';
import { RehearsalRecordings } from './rehearsal-recordings';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));
vi.mock('@/lib/audio/soundtouch', () => ({
  isSoundTouchSupported: () => false,
  attachSoundTouch: vi.fn(),
}));

let fakes: ReturnType<typeof installBrowserFakes>;
beforeEach(() => {
  fakes = installBrowserFakes();
});
afterEach(() => vi.unstubAllGlobals());

const recorder = () => FakeMediaRecorder.instances.at(-1)!;

function renderSong(songId = SONG2_ID, as: 'admin' | 'member' = 'member') {
  return renderWithProviders(<ReferenceAudios songId={songId} followSemitones={2} shownKey="A" />, {
    as,
  });
}

describe('gravar na tela da música', () => {
  it('grava, pausa, retoma, para, envia e dá nome', async () => {
    const { user } = renderSong();
    await screen.findByText('Nenhum áudio de referência ainda.');
    await user.click(screen.getByRole('button', { name: 'Gravar' }));
    await screen.findByTestId('cronometro');
    expect(fakes.getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
    });
    // Enquanto grava, "Enviar áudio" some (só aparece parado).
    expect(screen.queryByRole('button', { name: 'Enviar áudio' })).toBeNull();
    recorder().emit(1000);
    await user.click(screen.getByRole('button', { name: 'Pausar' }));
    expect(screen.getByTestId('cronometro').textContent).toContain('⏸');
    await user.click(screen.getByRole('button', { name: 'Retomar' }));
    await user.click(screen.getByRole('button', { name: 'Parar' }));
    expect(fakes.tracks[0]!.stop).toHaveBeenCalled();

    const pending = await screen.findByRole('list', { name: 'Gravações não enviadas' });
    await user.click(within(pending).getByRole('button', { name: 'Enviar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Dê um nome a este áudio' });
    expect(fake.calls.some((c) => c.name === 'check_audio_upload')).toBe(true);
    expect(fake.writes('media_files', 'insert')[0]).toMatchObject({
      kind: 'reference',
      song_id: SONG2_ID,
      event_id: null,
      created_by: MEMBER_ID,
    });
    await user.click(within(dialog).getByRole('button', { name: 'Arranjo' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar nome' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fake.writes('media_files', 'update')).toEqual([{ label: 'Arranjo' }]);
    expect(await screen.findByText('Arranjo')).toBeTruthy();
  });

  it('descartar gravação não enviada pede confirmação', async () => {
    const { user } = renderSong();
    await user.click(await screen.findByRole('button', { name: 'Gravar' }));
    await screen.findByTestId('cronometro');
    await user.click(screen.getByRole('button', { name: 'Parar' }));
    const pending = await screen.findByRole('list', { name: 'Gravações não enviadas' });
    await user.click(within(pending).getByRole('button', { name: 'Descartar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Descartar esta gravação?' });
    await user.click(within(dialog).getByRole('button', { name: 'Descartar' }));
    await waitFor(() =>
      expect(screen.queryByRole('list', { name: 'Gravações não enviadas' })).toBeNull(),
    );
  });

  it('microfone negado e navegador sem gravador', async () => {
    fakes.getUserMedia.mockRejectedValueOnce(new DOMException('negado', 'NotAllowedError'));
    const { user } = renderSong();
    await user.click(await screen.findByRole('button', { name: 'Gravar' }));
    expect(
      await screen.findByText(
        'Sem acesso ao microfone. Libere o microfone para este site nas configurações.',
      ),
    ).toBeTruthy();

    vi.stubGlobal('MediaRecorder', undefined);
    await user.click(screen.getByRole('button', { name: 'Gravar' }));
    expect(await screen.findByText(/Este navegador não grava áudio/)).toBeTruthy();
  });

  it('avisa perto de 45 MB e para sozinho no limite', async () => {
    const { user } = renderSong();
    await user.click(await screen.findByRole('button', { name: 'Gravar' }));
    await screen.findByTestId('cronometro');
    recorder().emit(41 * 1024 * 1024);
    expect(await screen.findByText(/chegando ao limite de 45 MB/)).toBeTruthy();
    recorder().emit(4 * 1024 * 1024);
    expect(await screen.findByText(/parou sozinha perto do limite/)).toBeTruthy();
  });

  it('envia arquivo: recusa acima de 45 MB; envia o válido; "Agora não" deixa sem nome', async () => {
    const { user } = renderSong();
    await screen.findByText('Nenhum áudio de referência ainda.');
    const input = screen.getByLabelText('Arquivo de áudio de referência');
    const big = new File([new Uint8Array(1)], 'grande.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(big, 'size', { value: 46 * 1024 * 1024 });
    await user.upload(input, big);
    expect(await screen.findByText(/o limite é 45 MB/)).toBeTruthy();

    await user.upload(input, new File(['abc'], 'voz.mp3', { type: 'audio/mpeg' }));
    const dialog = await screen.findByRole('dialog', { name: 'Dê um nome a este áudio' });
    await user.click(within(dialog).getByRole('button', { name: 'Agora não' }));
    expect(fake.writes('media_files', 'update')).toEqual([]);
    expect(await screen.findByText('Áudio 1')).toBeTruthy();
  });

  it('erro do banco antes de enviar (limite) e falha de rede no envio', async () => {
    const { user } = renderSong();
    await screen.findByText('Nenhum áudio de referência ainda.');
    fake.fail('rpc', 'check_audio_upload', {
      code: 'P0001',
      message: 'Esta música já tem 3 áudios de referência. Apague um para enviar outro.',
    });
    await user.upload(
      screen.getByLabelText('Arquivo de áudio de referência'),
      new File(['abc'], 'voz.mp3', { type: 'audio/mpeg' }),
    );
    expect(await screen.findByText(/já tem 3 áudios de referência/)).toBeTruthy();
    fake.reset({ ...fake.state, tables: fake.state.tables });
    FakeUploadXhr.status = 0;
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    // Hoje a tela mostra a mensagem genérica (pendência: mostrar a do envio, ex. "Sem conexão").
    expect(await screen.findByText(/Não foi possível enviar o áudio/)).toBeTruthy();
  });

  it('com 3 áudios, gravar e enviar ficam travados', async () => {
    renderWithProviders(<ReferenceAudios songId={SONG_ID} followSemitones={0} shownKey="A" />, {
      as: 'member',
      setup: (st) => {
        const first = st.tables!.media_files![0]!;
        st.tables!.media_files!.push(
          { ...first, id: 'm2', label: null, storage_path: `reference/${SONG_ID}/2.mp3` },
          { ...first, id: 'm3', label: null, storage_path: `reference/${SONG_ID}/3.mp3` },
        );
      },
    });
    expect(await screen.findByText(/Esta música já tem 3 áudios de referência/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Gravar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('button', { name: 'Enviar áudio' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('lista de áudios: renomear e apagar', () => {
  it('autora renomeia e apaga o próprio áudio', async () => {
    const { user } = renderSong(SONG_ID, 'member');
    await user.click(await screen.findByRole('button', { name: 'Renomear Voz guia' }));
    const dialog = await screen.findByRole('dialog', { name: 'Renomear áudio' });
    const field = within(dialog).getByLabelText('Nome do áudio');
    await user.clear(field);
    await user.type(field, 'x'.repeat(61));
    expect(within(dialog).getByText('Use até 60 caracteres.')).toBeTruthy();
    await user.clear(field);
    await user.type(field, '  Voz   guia nova ');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar nome' }));
    await waitFor(() =>
      expect(fake.writes('media_files', 'update')).toEqual([{ label: 'Voz guia nova' }]),
    );

    await user.click(await screen.findByRole('button', { name: /^Apagar / }));
    const confirm = await screen.findByRole('dialog', { name: 'Apagar este áudio?' });
    await user.click(within(confirm).getByRole('button', { name: 'Apagar' }));
    expect(await screen.findByText('Nenhum áudio de referência ainda.')).toBeTruthy();
  });

  it('renomear sem mudar nada fecha sem gravar; erro aparece no diálogo', async () => {
    const { user } = renderSong(SONG_ID, 'member');
    await user.click(await screen.findByRole('button', { name: 'Renomear Voz guia' }));
    let dialog = await screen.findByRole('dialog', { name: 'Renomear áudio' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar nome' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fake.writes('media_files', 'update')).toEqual([]);

    fake.fail('from', 'media_files', { code: '42501', message: 'permission denied' }, 'update');
    await user.click(screen.getByRole('button', { name: 'Renomear Voz guia' }));
    dialog = await screen.findByRole('dialog', { name: 'Renomear áudio' });
    await user.click(within(dialog).getByRole('button', { name: 'Voz guia' }));
    await user.type(within(dialog).getByLabelText('Nome do áudio'), '!');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar nome' }));
    expect(await within(dialog).findByText(/não tem permissão/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  });

  it('outra pessoa (sem media.manage) não vê renomear nem apagar', async () => {
    renderWithProviders(
      <ReferenceAudios songId={SONG_ID} followSemitones={null} shownKey={null} />,
      {
        as: 'member',
        setup: (s) => {
          s.tables!.media_files![0]!.created_by = 'outra-pessoa';
        },
      },
    );
    await screen.findByText('Voz guia');
    expect(screen.queryByRole('button', { name: /Renomear/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Apagar/ })).toBeNull();
  });
});

describe('gravações do ensaio', () => {
  it('grava, envia e pula o nome', async () => {
    const { user } = renderWithProviders(<RehearsalRecordings eventId={REHEARSAL_ID} />, {
      as: 'member',
    });
    await screen.findByText('Nenhuma gravação deste ensaio ainda.');
    await user.click(screen.getByRole('button', { name: 'Gravar ensaio' }));
    await screen.findByTestId('cronometro');
    await user.click(screen.getByRole('button', { name: 'Parar' }));
    const pending = await screen.findByRole('list', { name: 'Gravações não enviadas' });
    await user.click(within(pending).getByRole('button', { name: 'Enviar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Dê um nome a este áudio' });
    await user.click(within(dialog).getByRole('button', { name: 'Agora não' }));
    expect(await screen.findByText('Gravação 1')).toBeTruthy();
    expect(fake.writes('media_files', 'insert')[0]).toMatchObject({
      kind: 'rehearsal',
      event_id: REHEARSAL_ID,
    });
  });
});
