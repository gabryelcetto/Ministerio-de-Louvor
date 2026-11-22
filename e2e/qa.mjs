// QA automatizado: Chromium, WebKit (motor do Safari/iPhone) e Firefox, em 4 tamanhos, com admin e
// integrante, em todas as telas; tema escuro; casos de borda. Em cada tela:
//   - axe-core: falha em violações "serious" ou "critical";
//   - nenhum erro no console nem erro de página;
//   - nenhuma resposta 4xx/5xx inesperada da API;
//   - nenhum elemento saindo da largura da tela.
// Resultado: qa-output/qa-results.json, qa-output/resumo.md e prints dos problemas.
// Sai com código 1 se houver problema crítico ou alto.
// Uso (Supabase local + app rodando): BASE=http://127.0.0.1:5173 API_URL=... ANON_KEY=... DEMO_PASSWORD=... node e2e/qa.mjs
// Variáveis opcionais: QA_BROWSERS=chromium,webkit QA_SIZES=390x844 QA_SKIP_EDGE=1
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { chromium, firefox, webkit } from 'playwright';

const require = createRequire(import.meta.url);
const AXE = require.resolve('axe-core/axe.min.js');
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173';
const OUT = process.env.OUT ?? 'qa-output';
const PASSWORD = process.env.DEMO_PASSWORD;
const { API_URL, ANON_KEY } = process.env;
mkdirSync(`${OUT}/prints`, { recursive: true });

const ENGINES = { chromium, webkit, firefox };
const BROWSERS = (process.env.QA_BROWSERS ?? 'chromium,webkit,firefox').split(',');
const SIZES = (process.env.QA_SIZES ?? '375x667,390x844,768x1024,1440x900').split(',');
const ROLES = { admin: 'admin@demo.local', integrante: 'integrante@demo.local' };

const SONG = '00000000-0000-4000-8000-000000000001';
const EVENT = '10000000-0000-4000-8000-000000000002';
const REHEARSAL = '10000000-0000-4000-8000-000000000001';
let LONG_SONG = null; // criada no início (título e cifra muito longos)

function screensFor(role) {
  const list = [
    ['Início', '/'],
    ['Minhas escalas', '/escalas'],
    ['Detalhe do evento', `/escalas/${EVENT}`],
    ['Ensaio (gravações)', `/escalas/${REHEARSAL}`],
    ['Evento inexistente', '/escalas/99999999-0000-4000-8000-000000000000'],
    ['Agenda', '/agenda'],
    ['Repertório', '/repertorio'],
    ['Música', `/repertorio/${SONG}`],
    ['Música (aba letra)', `/repertorio/${SONG}?aba=letra`],
    ['Histórico da música', `/repertorio/${SONG}/historico`],
    ['Nova música', '/repertorio/nova'],
    ['Notificações', '/notificacoes'],
    ['Comunicados', '/comunicados'],
    ['Integrantes', '/integrantes'],
    ['Configurações', '/configuracoes'],
    ['Minhas indisponibilidades', '/indisponibilidades'],
    ['Mais', '/mais'],
    ['Instalar', '/instalar'],
    ['Página inexistente', '/nao-existe'],
  ];
  if (LONG_SONG) list.push(['Música com textos longos', `/repertorio/${LONG_SONG}`]);
  if (role === 'admin') {
    list.push(
      ['Montar escala', '/escalas/montar'],
      ['Atividade recente', '/atividade'],
      ['Cadastrar integrante', '/integrantes/cadastrar'],
      ['Funções do ministério', '/integrantes/funcoes'],
      ['Novo comunicado', '/comunicados/novo'],
    );
  }
  return list;
}

// ------------------------------------------------------------------------------- resultados
const findings = [];
let screensChecked = 0;
let shot = 0;
const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

async function record(page, finding) {
  const file = `${String(++shot).padStart(3, '0')}-${slug(`${finding.browser}-${finding.size}-${finding.tela}-${finding.tipo}`)}.png`;
  await page.screenshot({ path: `${OUT}/prints/${file}` }).catch(() => {});
  findings.push({ ...finding, print: `prints/${file}` });
  console.log(
    `${finding.gravidade === 'crítico' || finding.gravidade === 'alto' ? '❌' : '⚠️'} [${finding.gravidade}] ${finding.browser} ${finding.size} ${finding.perfil ?? ''} ${finding.tema ?? ''} — ${finding.tela}: ${finding.tipo} — ${finding.obtido}`,
  );
}

// ------------------------------------------------------------------------------- navegador
function contextOptions(browserName, size) {
  const [width, height] = size.split('x').map(Number);
  const mobile = width < 768;
  return {
    viewport: { width, height },
    // Firefox não emula "isMobile".
    ...(browserName !== 'firefox' && mobile ? { isMobile: true, hasTouch: true } : {}),
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'block',
  };
}

/** Coleta erros de console/página e respostas >= 400 da API desde o último `take()`. */
function watch(page) {
  const events = [];
  // Enquanto o PRÓPRIO roteiro troca de página, o WebKit registra as consultas do documento
  // antigo que foram canceladas como "Fetch API cannot load … due to access control checks".
  // Isso não acontece com quem usa o app (é o descarte da página anterior): fica de fora.
  let navigating = false;
  page.on('console', (m) => {
    if (m.type() === 'error') events.push({ kind: 'console', text: m.text() });
  });
  page.on('pageerror', (e) => {
    if (navigating && /due to access control checks/.test(e.message)) return;
    events.push({ kind: 'pageerror', text: e.message });
  });
  page.on('response', async (r) => {
    if (!r.url().includes(':54321') || r.status() < 400) return;
    let body = '';
    try {
      body = (await r.text()).slice(0, 200);
    } catch {
      // corpo indisponível
    }
    events.push({
      kind: 'http',
      status: r.status(),
      text: `${r.status()} ${r.request().method()} ${r.url().replace(/^.*:54321/, '')} ${body}`,
    });
  });
  let from = 0;
  return {
    /** Abre o endereço e espera a página assentar (com o filtro acima ligado). */
    async go(url) {
      navigating = true;
      try {
        await page.goto(url).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      } finally {
        navigating = false;
      }
    },
    take() {
      const slice = events.slice(from);
      from = events.length;
      return slice;
    },
  };
}

async function login(page, email, password = PASSWORD, { theme = 'system' } = {}) {
  // Tema já escolhido (Automático): o modal de primeiro acesso é verificado à parte.
  if (theme)
    await page.context().addInitScript((t) => {
      try {
        if (!localStorage.getItem('louvor.theme')) localStorage.setItem('louvor.theme', t);
      } catch {
        // armazenamento indisponível
      }
    }, theme);
  await page.goto(`${BASE}/login`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  // Espera o Início terminar de carregar: sair no meio de uma consulta faz o WebKit registrar
  // "Fetch API cannot load … due to access control checks" (falso positivo do roteiro).
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function axeCheck(page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const result = await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
      resultTypes: ['violations'],
    });
    return result.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
      }));
  });
}

async function overflowCheck(page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const pageScroll = document.documentElement.scrollWidth > width + 1;
    const offenders = [];
    const describe = (el) =>
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${
        typeof el.className === 'string' && el.className
          ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
          : ''
      } "${(el.textContent ?? '').trim().slice(0, 40)}"`;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.right <= width + 1) continue;
      const style = getComputedStyle(el);
      if (style.position === 'fixed' || style.visibility === 'hidden') continue;
      // Dentro de um contêiner com rolagem/corte horizontal: não sai da tela.
      let parent = el.parentElement;
      let contained = false;
      while (parent && parent !== document.body) {
        if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(parent).overflowX)) {
          contained = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (!contained) offenders.push(`${describe(el)} (direita em ${Math.round(r.right)}px)`);
      if (offenders.length >= 5) break;
    }
    return { pageScroll, offenders };
  });
}

/** Erros de rede esperados numa tela (ex.: nenhum). */
const EXPECTED_HTTP = [];

async function checkScreen(page, monitor, base) {
  await settle(page);
  screensChecked++;
  const events = monitor.take();
  for (const e of events) {
    if (e.kind === 'http' && EXPECTED_HTTP.some((re) => re.test(e.text))) continue;
    await record(page, {
      ...base,
      tipo:
        e.kind === 'http'
          ? `resposta ${e.status} da API`
          : e.kind === 'pageerror'
            ? 'erro de página'
            : 'erro no console',
      esperado:
        e.kind === 'http' ? 'nenhuma resposta 4xx/5xx inesperada' : 'nenhum erro no console',
      obtido: e.text.slice(0, 300),
      gravidade:
        e.kind === 'pageerror' || (e.kind === 'http' && e.status >= 500) ? 'crítico' : 'alto',
    });
  }
  const overflow = await overflowCheck(page);
  if (overflow.pageScroll || overflow.offenders.length) {
    await record(page, {
      ...base,
      tipo: 'elemento saindo da largura da tela',
      esperado: 'nada passa da largura da tela (sem rolagem lateral)',
      obtido:
        `${overflow.pageScroll ? 'página com rolagem lateral; ' : ''}${overflow.offenders.join('; ')}`.slice(
          0,
          400,
        ),
      gravidade: overflow.pageScroll ? 'alto' : 'médio',
    });
  }
  const violations = await axeCheck(page).catch((e) => [
    { id: 'axe-erro', impact: 'serious', help: e.message, nodes: [] },
  ]);
  for (const v of violations) {
    await record(page, {
      ...base,
      tipo: `acessibilidade (axe: ${v.id})`,
      esperado: 'nenhuma violação séria ou crítica',
      obtido: `${v.impact}: ${v.help} — ${v.nodes.join(' | ')}`.slice(0, 400),
      gravidade: v.impact === 'critical' ? 'crítico' : 'alto',
    });
  }
}

// ------------------------------------------------------------------------------- preparação
async function apiClient(email) {
  const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return client;
}

async function prepare() {
  const admin = await apiClient(ROLES.admin);
  const longWord = 'Aleluiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const chords = Array.from(
    { length: 8 },
    (_, i) =>
      `[G]Linha ${i + 1} com uma frase bem comprida para testar quebra de [D]linha no celular ${longWord} [Em]e mais [C]acordes [Am7/G]no [F#m7(b5)]fim`,
  ).join('\n');
  const { data, error } = await admin.rpc('create_song', {
    p_title:
      `Música com um título muito, muito longo para ver se a tela quebra a linha direito ${'e continua '.repeat(6)}`.slice(
        0,
        200,
      ),
    p_artist: 'Autor com nome igualmente comprido para testar o cabeçalho da música no celular',
    p_category: 'Categoria longa de teste',
    p_original_key: 'G',
    p_official_key: 'A',
    p_media_url: null,
    p_notes: `Observação longa: ${'texto '.repeat(60)}`,
    p_lyrics: chords.replace(/\[[^\]]+\]/g, ''),
    p_chords: chords,
  });
  if (error) console.log(`⚠️ não criou a música de textos longos: ${error.message}`);
  else LONG_SONG = data;
}

// ------------------------------------------------------------------------------- varredura
async function sweep(browserName) {
  const browser = await ENGINES[browserName].launch(
    browserName === 'chromium'
      ? { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }
      : {},
  );
  for (const size of SIZES) {
    for (const [perfil, email] of Object.entries(ROLES)) {
      const context = await browser.newContext(contextOptions(browserName, size));
      const page = await context.newPage();
      const monitor = watch(page);
      try {
        await login(page, email);
      } catch (e) {
        await record(page, {
          browser: browserName,
          size,
          perfil,
          tela: 'Login',
          passos: 'Entrar com e-mail e senha',
          tipo: 'login falhou',
          esperado: 'entrar no app',
          obtido: e.message.split('\n')[0],
          gravidade: 'crítico',
        });
        await context.close();
        continue;
      }
      monitor.take();
      // Tema escuro em todas as telas: Chromium, no celular e no computador.
      const themes =
        browserName === 'chromium' && (size === '390x844' || size === '1440x900')
          ? ['claro', 'escuro']
          : ['claro'];
      for (const tema of themes) {
        await page.emulateMedia({ colorScheme: tema === 'escuro' ? 'dark' : 'light' });
        for (const [tela, path] of screensFor(perfil)) {
          await monitor.go(`${BASE}${path}`);
          await checkScreen(page, monitor, {
            browser: browserName,
            size,
            perfil,
            tema,
            tela,
            passos: `Entrar como ${perfil}, abrir ${path}${tema === 'escuro' ? ' (tema escuro)' : ''}`,
          });
        }
      }
      await context.close();
    }
    // Modal "Como você prefere ver o app?" (primeiro acesso), nos dois temas.
    if (browserName === 'chromium' && (size === '390x844' || size === '1440x900')) {
      for (const tema of ['claro', 'escuro']) {
        const context = await browser.newContext(contextOptions(browserName, size));
        const page = await context.newPage();
        await page.emulateMedia({ colorScheme: tema === 'escuro' ? 'dark' : 'light' });
        const monitor = watch(page);
        const base = {
          browser: browserName,
          size,
          perfil: 'integrante',
          tema,
          tela: 'Modal de tema (1º acesso)',
          passos: 'Entrar pela primeira vez neste aparelho',
        };
        try {
          await login(page, ROLES.integrante, PASSWORD, { theme: null });
          await page
            .getByRole('dialog', { name: 'Como você prefere ver o app?' })
            .waitFor({ timeout: 10000 });
          await checkScreen(page, monitor, base);
        } catch (e) {
          await record(page, {
            ...base,
            tipo: 'modal de tema não apareceu',
            esperado: 'pergunta o tema no primeiro acesso',
            obtido: e.message.split('\n')[0],
            gravidade: 'alto',
          });
        }
        await context.close();
      }
    }
  }
  await browser.close();
}

// ------------------------------------------------------------------------------- casos de borda
const edge = [];
async function edgeCase(name, browserName, size, fn) {
  const browser = await ENGINES[browserName].launch(
    browserName === 'chromium' && !name.includes('microfone')
      ? { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }
      : {},
  );
  const context = await browser.newContext(contextOptions(browserName, size));
  const page = await context.newPage();
  const monitor = watch(page);
  const base = { browser: browserName, size, perfil: 'integrante', tela: name };
  try {
    await login(page, ROLES.integrante);
    monitor.take();
    const result = await fn({ page, context, monitor, base });
    edge.push({ name, browserName, size, ok: !result?.problem, detail: result?.detail ?? '' });
    if (result?.problem) await record(page, { ...base, ...result.problem });
    else
      console.log(
        `✅ borda: ${name} (${browserName} ${size})${result?.detail ? ` — ${result.detail}` : ''}`,
      );
    // Erros de página em qualquer caso de borda também contam.
    for (const e of monitor.take().filter((x) => x.kind === 'pageerror')) {
      await record(page, {
        ...base,
        passos: name,
        tipo: 'erro de página',
        esperado: 'nenhum erro',
        obtido: e.text,
        gravidade: 'crítico',
      });
    }
  } catch (e) {
    edge.push({ name, browserName, size, ok: false, detail: e.message.split('\n')[0] });
    await record(page, {
      ...base,
      passos: name,
      tipo: 'caso de borda não concluído',
      esperado: 'o roteiro do caso de borda termina',
      obtido: e.message.split('\n')[0].slice(0, 300),
      gravidade: 'médio',
    });
  }
  await context.close();
  await browser.close();
}

const lyricsField = (page) => page.getByRole('textbox', { name: 'Letra' });

async function openLyricsEditor(page) {
  await page.goto(`${BASE}/repertorio/${SONG}`);
  await settle(page);
  // Editar letra fica no menu ⋯ do cabeçalho.
  await page.getByRole('button', { name: 'Mais opções', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Editar letra', exact: true }).click();
  await lyricsField(page).waitFor();
}

async function edgeCases() {
  for (const browserName of BROWSERS) {
    await edgeCase('Duplo clique em salvar (letra)', browserName, '390x844', async ({ page }) => {
      await openLyricsEditor(page);
      await lyricsField(page).fill(`Letra QA duplo clique ${browserName} ${Date.now()}`);
      let writes = 0;
      page.on('request', (r) => {
        if (r.url().includes('/rest/v1/song_lyrics') && r.method() !== 'GET') writes++;
      });
      await page.getByRole('button', { name: 'Salvar letra' }).dblclick();
      await page.getByText('Letra salva.').waitFor({ timeout: 15000 });
      await page.waitForTimeout(800);
      return writes === 1
        ? { detail: '1 gravação' }
        : {
            problem: {
              passos: 'Editar letra → alterar → duplo clique em "Salvar letra"',
              tipo: 'duplo clique grava duas vezes',
              esperado: 'uma gravação só',
              obtido: `${writes} gravações`,
              gravidade: 'médio',
            },
          };
    });

    await edgeCase('Troca rápida de tom', browserName, '390x844', async ({ page, monitor }) => {
      await page.goto(`${BASE}/repertorio/${SONG}`);
      await settle(page);
      const up = page.getByRole('button', { name: 'Subir meio tom', exact: true });
      for (let i = 0; i < 24; i++) await up.click({ delay: 0 });
      await settle(page);
      const tom = new URL(page.url()).searchParams.get('tom');
      const errors = monitor.take().filter((e) => e.kind !== 'http');
      return errors.length
        ? {
            problem: {
              passos: 'Música → "Subir meio tom" 24 vezes seguidas',
              tipo: 'erro ao trocar o tom rapidamente',
              esperado: 'volta ao mesmo tom, sem erros',
              obtido: errors
                .map((e) => e.text)
                .join(' | ')
                .slice(0, 300),
              gravidade: 'alto',
            },
          }
        : { detail: `tom final ${tom}` };
    });

    await edgeCase('Arquivo acima de 45 MB', browserName, '390x844', async ({ page }) => {
      await page.goto(`${BASE}/repertorio/${SONG}`);
      await settle(page);
      const big = join(tmpdir(), `qa-grande-${browserName}.mp3`);
      writeFileSync(big, Buffer.alloc(46 * 1024 * 1024, 1));
      await page.getByLabel('Arquivo de áudio de referência').setInputFiles(big);
      await page.getByText(/o limite é 45 MB/).waitFor({ timeout: 10000 });
      return { detail: 'recusado na hora, sem enviar' };
    });
  }

  await edgeCase('Internet lenta ao salvar', 'chromium', '390x844', async ({ page }) => {
    await openLyricsEditor(page);
    await lyricsField(page).fill(`Letra QA internet lenta ${Date.now()}`);
    await page.route('**/rest/v1/song_lyrics**', async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await page.getByRole('button', { name: 'Salvar letra' }).click();
    const saving = page.getByRole('button', { name: 'Salvando…' });
    const disabled = await saving.isDisabled({ timeout: 2000 }).catch(() => false);
    await page.getByText('Letra salva.').waitFor({ timeout: 15000 });
    return disabled
      ? { detail: '"Salvando…" com o botão travado' }
      : {
          problem: {
            passos: 'Editar letra → internet lenta (2,5 s) → Salvar',
            tipo: 'sem indicação de salvamento em andamento',
            esperado: 'botão "Salvando…" desativado até terminar',
            obtido: 'botão continuou ativo',
            gravidade: 'médio',
          },
        };
  });

  await edgeCase('Offline ao salvar', 'chromium', '390x844', async ({ page, context }) => {
    await openLyricsEditor(page);
    const text = `Letra QA offline ${Date.now()}`;
    await lyricsField(page).fill(text);
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Salvar letra' }).click();
    const message = page.getByText(/Sem conexão/);
    const shown = await message.waitFor({ timeout: 15000 }).then(
      () => true,
      () => false,
    );
    const kept =
      (await lyricsField(page)
        .inputValue()
        .catch(() => '')) === text;
    const onScreen = await page
      .locator('form [role="alert"], form button[type="submit"]')
      .allInnerTexts()
      .catch(() => []);
    await context.setOffline(false);
    if (!shown || !kept) {
      return {
        problem: {
          passos: 'Editar letra → ficar sem internet → Salvar',
          tipo: 'sem internet ao salvar',
          esperado: 'mensagem "Sem conexão…" e o texto continua no campo',
          obtido: `${shown ? 'mensagem ok' : 'sem a mensagem de conexão em 15 s'}; ${kept ? 'texto mantido' : 'texto perdido'}; na tela: ${onScreen.join(' | ').slice(0, 150)}`,
          gravidade: kept ? 'médio' : 'alto',
        },
      };
    }
    await page.getByRole('button', { name: 'Salvar letra' }).click();
    await page.getByText('Letra salva.').waitFor({ timeout: 15000 });
    return { detail: 'mensagem de conexão, texto mantido e salvou ao voltar' };
  });

  await edgeCase('Offline ao enviar áudio', 'chromium', '390x844', async ({ page, context }) => {
    await page.goto(`${BASE}/escalas/${REHEARSAL}`);
    await settle(page);
    await page.getByRole('button', { name: 'Gravar ensaio' }).click();
    await page.getByTestId('cronometro').waitFor();
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Parar' }).click();
    const pending = page.getByRole('list', { name: 'Gravações não enviadas' });
    await pending.waitFor({ timeout: 15000 });
    await context.setOffline(true);
    await pending.getByRole('button', { name: 'Enviar' }).click();
    const alert = pending.getByRole('alert');
    const appeared = await alert.waitFor({ timeout: 20000 }).then(
      () => true,
      () => false,
    );
    if (!appeared) {
      const onScreen = (await pending.innerText()).replace(/\s+/g, ' ').slice(0, 120);
      await context.setOffline(false);
      return {
        problem: {
          passos: 'Ensaio → Gravar → Parar → ficar sem internet → Enviar',
          tipo: 'envio de áudio parado sem internet',
          esperado:
            'erro "Sem conexão…" logo, com "Tentar de novo"; a gravação continua no aparelho',
          obtido: `sem resposta em 20 s; na tela: ${onScreen}`,
          gravidade: 'médio',
        },
      };
    }
    const text = await alert.innerText();
    await context.setOffline(false);
    // Limpa a gravação de teste.
    await pending.getByRole('button', { name: 'Descartar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Descartar' }).click();
    const specific = /Sem conexão/.test(text);
    return specific
      ? { detail: text }
      : {
          problem: {
            passos: 'Ensaio → Gravar → Parar → ficar sem internet → Enviar',
            tipo: 'mensagem genérica sem internet ao enviar áudio',
            esperado: '"Sem conexão. Tente de novo." e a gravação continua no aparelho',
            obtido: text.slice(0, 200),
            gravidade: 'médio',
          },
        };
  });

  await edgeCase(
    'Voltar do navegador no meio do formulário',
    'chromium',
    '390x844',
    async ({ page }) => {
      // Como a pessoa usa: chega à Nova música pelo próprio app (o Voltar volta dentro do app).
      await page.goto(`${BASE}/repertorio`);
      await settle(page);
      await page.getByRole('link', { name: 'Nova música' }).click();
      await page.waitForURL(/\/repertorio\/nova$/);
      await settle(page);
      await page.getByLabel('Título').fill('Música digitada e não salva');
      await page.goBack({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
      const dialog = page.getByRole('dialog', { name: 'Sair sem salvar?' });
      const guarded = await dialog.isVisible().catch(() => false);
      if (guarded) {
        await dialog.getByRole('button', { name: 'Continuar editando' }).click();
        const value = await page.getByLabel('Título').inputValue();
        return {
          detail: `confirmação apareceu; texto mantido: ${value === 'Música digitada e não salva'}`,
        };
      }
      return {
        problem: {
          passos:
            'Repertório → tocar em Nova música → digitar o título → botão Voltar do navegador',
          tipo: 'formulário perdido ao voltar',
          esperado: 'confirmação "Sair sem salvar?" antes de perder o que foi digitado',
          obtido: `saiu da tela sem perguntar (${new URL(page.url()).pathname})`,
          gravidade: 'alto',
        },
      };
    },
  );

  await edgeCase('Sessão expirada', 'chromium', '390x844', async ({ page }) => {
    await page.goto(`${BASE}/repertorio`);
    await settle(page);
    // Token e refresh inválidos no navegador (como uma sessão vencida há dias).
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (!key.includes('auth-token')) continue;
        const value = JSON.parse(localStorage.getItem(key));
        value.access_token = 'expirado';
        value.refresh_token = 'expirado';
        value.expires_at = Math.floor(Date.now() / 1000) - 3600;
        localStorage.setItem(key, JSON.stringify(value));
      }
    });
    await page.goto(`${BASE}/repertorio`);
    await page
      .waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 20000 })
      .catch(() => {});
    const atLogin = new URL(page.url()).pathname.startsWith('/login');
    return atLogin
      ? { detail: 'voltou para o login' }
      : {
          problem: {
            passos: 'Logado → sessão vence (token e refresh inválidos) → abrir o Repertório',
            tipo: 'sessão expirada',
            esperado: 'volta para o login (ou avisa "Sua sessão expirou")',
            obtido: `ficou em ${new URL(page.url()).pathname}: ${(
              await page
                .locator('main')
                .innerText()
                .catch(() => '')
            ).slice(0, 150)}`,
            gravidade: 'alto',
          },
        };
  });

  await edgeCase('Permissão de microfone negada', 'chromium', '390x844', async ({ page }) => {
    await page.goto(`${BASE}/escalas/${REHEARSAL}`);
    await settle(page);
    await page.getByRole('button', { name: 'Gravar ensaio' }).click();
    const message = page.getByText(/Sem acesso ao microfone/);
    const shown = await message.waitFor({ timeout: 15000 }).then(
      () => true,
      () => false,
    );
    return shown
      ? { detail: 'mensagem de microfone' }
      : {
          problem: {
            passos: 'Ensaio → Gravar ensaio com o microfone bloqueado',
            tipo: 'microfone negado sem explicação',
            esperado: '"Sem acesso ao microfone. Libere o microfone para este site…"',
            obtido: (await page.locator('main').innerText()).slice(0, 200),
            gravidade: 'alto',
          },
        };
  });

  await edgeCase('Listas vazias', 'chromium', '390x844', async ({ page }) => {
    await page.goto(`${BASE}/repertorio`);
    await settle(page);
    await page.getByLabel('Buscar música').fill('zzzz nenhuma música zzzz');
    await page.getByText(/Nenhuma música/).waitFor({ timeout: 10000 });
    await page.goto(`${BASE}/integrantes`);
    await settle(page);
    await page.getByLabel('Buscar integrante').fill('zzzz');
    await page.getByText('Ninguém encontrado com esse nome.').waitFor({ timeout: 10000 });
    return { detail: 'mensagens de lista vazia no repertório e em integrantes' };
  });
}

// ------------------------------------------------------------------------------- execução
const started = Date.now();
await prepare();
await Promise.all(BROWSERS.map((b) => sweep(b)));
if (!process.env.QA_SKIP_EDGE) await edgeCases();

const order = { crítico: 0, alto: 1, médio: 2, baixo: 3 };
findings.sort((a, b) => order[a.gravidade] - order[b.gravidade]);
const count = (g) => findings.filter((f) => f.gravidade === g).length;
writeFileSync(
  `${OUT}/qa-results.json`,
  JSON.stringify({ screensChecked, browsers: BROWSERS, sizes: SIZES, edge, findings }, null, 2),
);
const summary = [
  '## QA automatizado',
  '',
  `Telas verificadas: **${screensChecked}** (${BROWSERS.join(', ')}; ${SIZES.join(', ')}; admin e integrante; temas claro e escuro no Chromium) em ${Math.round((Date.now() - started) / 60000)} min.`,
  '',
  `| Gravidade | Problemas |`,
  `| --- | --- |`,
  ...['crítico', 'alto', 'médio', 'baixo'].map((g) => `| ${g} | ${count(g)} |`),
  '',
  `Casos de borda: ${edge.filter((e) => e.ok).length}/${edge.length} sem problema.`,
  '',
  ...findings
    .slice(0, 60)
    .map(
      (f) =>
        `- **[${f.gravidade}]** ${f.browser} ${f.size} ${f.perfil ?? ''} ${f.tema ?? ''} — ${f.tela}: ${f.tipo} — ${f.obtido}`,
    ),
].join('\n');
writeFileSync(`${OUT}/resumo.md`, `${summary}\n`);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
console.log(`\n${summary}`);
if (count('crítico') + count('alto') > 0) process.exit(1);
