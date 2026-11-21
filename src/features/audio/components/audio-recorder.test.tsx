import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// O módulo importa o cliente Supabase (que exige variáveis de ambiente); aqui não há rede.
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const { RecorderControls, UploadProgress } = await import('./audio-recorder');
type View = Parameters<typeof RecorderControls>[0]['recorder'];

const idle: View = {
  state: 'idle',
  elapsedMs: 0,
  bytes: 0,
  level: 'ok',
  error: null,
  autoStopped: false,
  wakeLockOn: false,
};
const noop = () => undefined;

function render(recorder: View, extra: Partial<Parameters<typeof RecorderControls>[0]> = {}) {
  return renderToStaticMarkup(
    <RecorderControls
      recorder={recorder}
      startLabel="Gravar"
      onStart={noop}
      onPause={noop}
      onResume={noop}
      onStop={noop}
      {...extra}
    />,
  );
}

/** Texto visível dos botões, na ordem. */
const buttons = (html: string) =>
  [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) =>
    (m[1] ?? '').replace(/<[^>]+>/g, '').trim(),
  );

describe('RecorderControls (gravação comum a ensaio e música)', () => {
  it('parado: botão de gravar com o rótulo de cada tela e as ações ao lado', () => {
    const html = render(idle, { extraActions: <button type="button">Enviar áudio</button> });
    expect(buttons(html)).toEqual(['Gravar', 'Enviar áudio']);
    expect(html).not.toContain('cronometro');
    expect(render(idle, { startLabel: 'Gravar ensaio' })).toContain('Gravar ensaio');
  });

  it('desativado (ex.: música com 3 áudios): não deixa começar', () => {
    expect(render(idle, { disabled: true })).toMatch(/<button[^>]*disabled=""[^>]*>.*Gravar/);
  });

  it('abrindo o microfone: avisa e não deixa clicar de novo', () => {
    const html = render({ ...idle, state: 'starting' });
    expect(buttons(html)).toEqual(['Abrindo o microfone…']);
    expect(html).toContain('disabled=""');
  });

  it('gravando: pausar, parar, cronômetro, tamanho e tela acesa; esconde as outras ações', () => {
    const html = render(
      { ...idle, state: 'recording', elapsedMs: 65_400, bytes: 2 * 1024 * 1024, wakeLockOn: true },
      { extraActions: <button type="button">Enviar áudio</button> },
    );
    expect(buttons(html)).toEqual(['Pausar', 'Parar']);
    expect(html).toContain('data-testid="cronometro"');
    expect(html).toContain('1:05');
    expect(html).toContain('2 MB de 45 MB');
    expect(html).toContain('tela acesa');
  });

  it('pausado: retomar no lugar de pausar e cronômetro com o símbolo de pausa', () => {
    const html = render({ ...idle, state: 'paused', elapsedMs: 3_000 });
    expect(buttons(html)).toEqual(['Retomar', 'Parar']);
    expect(html).toContain('⏸ 0:03');
  });

  it('avisa perto de 45 MB e quando parou sozinho', () => {
    expect(render({ ...idle, state: 'recording', level: 'warn' })).toContain(
      'chegando ao limite de 45 MB',
    );
    expect(render({ ...idle, autoStopped: true })).toContain('parou sozinha perto do limite');
  });

  it('mostra o erro do gravador (microfone negado etc.)', () => {
    const html = render({ ...idle, error: 'Sem acesso ao microfone.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Sem acesso ao microfone.');
  });

  it('barra de progresso do envio em porcentagem', () => {
    const html = renderToStaticMarkup(<UploadProgress value={0.426} />);
    expect(html).toContain('aria-label="Progresso do envio"');
    expect(html).toContain('43%');
  });
});
