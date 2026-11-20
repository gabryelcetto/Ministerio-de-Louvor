// Roteiro de fluxos de docs/roteiro-de-teste.md com dados reais (Supabase local).
// Cada passo vira ✅/❌ no relatório; uma falha não interrompe os passos seguintes.
// Uso: BASE=http://127.0.0.1:5173 DEMO_PASSWORD=... node e2e/fluxos.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'e2e-output';
const PASSWORD = process.env.DEMO_PASSWORD;
mkdirSync(`${OUT}/fluxos`, { recursive: true });

const SONG = '00000000-0000-4000-8000-000000000001';
const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1366, height: 900 } };

const results = [];
let shot = 0;
const browser = await chromium.launch(
  process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {},
);

async function session(email, device, password = PASSWORD) {
  const context = await browser.newContext({
    ...device,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.apiErrors = [];
  page.on('response', async (r) => {
    if (r.url().includes(':54321') && r.status() >= 400) {
      let body = '';
      try {
        body = (await r.text()).slice(0, 200);
      } catch {
        // corpo indisponível
      }
      page.apiErrors.push(
        `${r.status()} ${r.request().method()} ${r.url().replace(/^.*:54321/, '')} ${body}`,
      );
    }
  });
  page.on('pageerror', (e) => page.apiErrors.push(`pageerror: ${e.message}`));
  await page.goto(`${BASE}/login`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  return { context, page };
}

async function step(page, who, label, fn, { expectApiErrors = false } = {}) {
  const before = page.apiErrors.length;
  const name = `${String(++shot).padStart(2, '0')}-${who}-${label}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .slice(0, 70);
  let ok = true;
  let detail = '';
  try {
    detail = (await fn()) ?? '';
  } catch (e) {
    ok = false;
    detail = e.message.split('\n')[0];
  }
  const api = page.apiErrors.slice(before);
  if (api.length && !expectApiErrors) {
    ok = false;
    detail += ` | API: ${api.join(' || ')}`;
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/fluxos/${name}.png`, fullPage: true }).catch(() => {});
  results.push({ who, label, ok, detail, shot: `${name}.png` });
  console.log(`${ok ? '✅' : '❌'} [${who}] ${label}${detail ? ` — ${detail}` : ''}`);
}

const main = (page) => page.locator('main');
/** Repete `fn` até devolver true (a lista pode levar um instante para atualizar). */
const poll = async (fn, what, timeout = 8000) => {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last === true) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${what} (último valor: ${last})`);
};
const expectText = async (page, text, timeout = 8000) => {
  await main(page).getByText(text).first().waitFor({ timeout });
};

// =============================================================================== INTEGRANTE
{
  const { context, page } = await session('integrante@demo.local', MOBILE);
  const who = 'integrante';

  await step(page, who, 'Início com saudação e próximo culto', async () => {
    await expectText(page, /Isa/);
    await expectText(page, 'Culto de celebração');
    await expectText(page, 'Ensaio geral');
    await expectText(page, /Bateria/);
  });

  await step(page, who, 'Música do repertório do culto abre no tom do dia', async () => {
    await main(page).locator('a[href*="/repertorio/"][href*="tom="]').first().click();
    await page.waitForURL(/\/repertorio\/.+tom=/);
    await page.waitForLoadState('networkidle');
    return page.url().replace(BASE, '');
  });

  await step(page, who, 'Repertório lista 12 músicas', async () => {
    await page.goto(`${BASE}/repertorio`);
    await page.waitForLoadState('networkidle');
    const n = await main(page).locator('a[href^="/repertorio/"]').count();
    if (n !== 12) throw new Error(`${n} músicas na lista`);
    return `${n} músicas`;
  });

  await step(page, who, 'Busca sem acento "cantico"', async () => {
    await page.getByLabel('Buscar música').fill('cantico');
    await expectText(page, 'Cântico da Manhã');
    await poll(
      async () => (await main(page).locator('a[href^="/repertorio/"]').count()) === 1,
      'esperava 1 resultado',
    );
  });

  await step(page, who, 'Busca sem resultado', async () => {
    await page.getByLabel('Buscar música').fill('zzzzzz');
    await expectText(page, 'Nenhuma música encontrada');
  });

  await step(page, who, 'Abrir música e transpor meio tom acima', async () => {
    await page.goto(`${BASE}/repertorio/${SONG}`);
    await page.waitForLoadState('networkidle');
    const tom = page.getByRole('combobox', { name: 'Tom', exact: true });
    const antes = await tom.inputValue();
    await page.getByRole('button', { name: 'Subir meio tom' }).click();
    await page.waitForURL(/tom=/);
    await poll(async () => (await tom.inputValue()) !== antes, `tom não mudou (${antes})`);
    const depois = await tom.inputValue();
    return `${antes} → ${depois}`;
  });

  await step(page, who, 'Escolher tom no seletor e voltar ao oficial', async () => {
    await page.getByRole('combobox', { name: 'Tom', exact: true }).selectOption('E');
    await page.waitForURL(/tom=E/);
    await page.getByRole('button', { name: /Oficial/ }).click();
    await page.waitForURL((u) => !u.search.includes('tom=E'));
  });

  await step(page, who, 'Integrante não vê Editar cifra nem Definir tom oficial', async () => {
    if (await page.getByRole('button', { name: /Editar cifra/ }).count())
      throw new Error('botão Editar cifra visível');
    if (await page.getByRole('button', { name: /Definir tom oficial/ }).count())
      throw new Error('botão Definir tom oficial visível');
    await page.getByRole('button', { name: 'Editar letra' }).waitFor();
  });

  await step(page, who, 'Editar letra e salvar', async () => {
    await page.getByRole('button', { name: 'Editar letra' }).click();
    const box = page.getByRole('textbox', { name: 'Letra', exact: true });
    await box.fill(`${await box.inputValue()}\nVerso de teste (integrante)`);
    await page.getByRole('button', { name: 'Salvar letra' }).click();
    await expectText(page, 'Letra salva.');
  });

  await step(page, who, 'Histórico sem botão Restaurar', async () => {
    await page.goto(`${BASE}/repertorio/${SONG}/historico`);
    await page.waitForLoadState('networkidle');
    await expectText(page, /Letra/);
    if (await page.getByRole('button', { name: 'Restaurar' }).count())
      throw new Error('botão Restaurar visível');
  });

  await step(page, who, 'Montar escala bloqueado', async () => {
    await page.goto(`${BASE}/escalas/montar`);
    await expectText(page, 'Você não tem permissão para montar escalas.');
  });

  await step(page, who, 'Minhas escalas', async () => {
    await page.goto(`${BASE}/escalas`);
    await page.waitForLoadState('networkidle');
    await expectText(page, 'Culto de celebração');
    if (await page.getByRole('link', { name: 'Montar escala' }).count())
      throw new Error('botão Montar escala visível');
  });

  await step(page, who, 'Detalhe do evento com equipe e repertório', async () => {
    await page.goto(`${BASE}/escalas/10000000-0000-4000-8000-000000000002`);
    await page.waitForLoadState('networkidle');
    await expectText(page, 'Culto de celebração');
    await expectText(page, /Lucas/);
    await expectText(page, /Doxologia/);
  });

  await step(page, who, 'Agenda com 5 eventos', async () => {
    await page.goto(`${BASE}/agenda`);
    await page.waitForLoadState('networkidle');
    for (const t of [
      'Ensaio geral',
      'Culto de celebração',
      'Ensaio de vozes',
      'Culto da família',
      'Noite de louvor',
    ])
      await expectText(page, t);
  });

  await step(page, who, 'Integrantes sem telefone', async () => {
    await page.goto(`${BASE}/integrantes`);
    await page.waitForLoadState('networkidle');
    await expectText(page, /Lucas/);
    const tel = await main(page).locator('a[href^="tel:"]').count();
    if (tel) throw new Error(`${tel} telefones visíveis`);
  });

  await step(page, who, 'Comunicados', async () => {
    await page.goto(`${BASE}/comunicados`);
    await page.waitForLoadState('networkidle');
    await expectText(page, 'Bem-vindos à nova plataforma');
  });

  await step(page, who, 'Notificações: marcar todas como lidas', async () => {
    await page.goto(`${BASE}/notificacoes`);
    await page.waitForLoadState('networkidle');
    await expectText(page, /Você foi escalado/);
    await page.getByRole('button', { name: 'Marcar todas como lidas' }).click();
    await page.getByRole('button', { name: 'Marcar todas como lidas' }).isDisabled();
    await page.waitForLoadState('networkidle');
    await poll(
      async () => (await page.getByRole('button', { name: /^Marcar como lida:/ }).count()) === 0,
      'ainda há não lidas',
    );
  });

  // Configurações é a tela pessoal (perfil, tema, instalar, sair): aparece para todos.
  await step(page, who, 'Menu Mais abre, mostra os itens e fecha com Esc', async () => {
    await page.goto(`${BASE}/`);
    const button = page.getByRole('button', { name: /^Mais/ });
    await button.click();
    const menu = page.getByRole('navigation', { name: 'Mais opções' });
    for (const item of ['Notificações', 'Comunicados', 'Integrantes', 'Configurações'])
      await menu.getByRole('link', { name: item }).waitFor();
    await page.keyboard.press('Escape');
    await poll(
      () => button.evaluate((el) => el === document.activeElement),
      'foco não voltou ao Mais',
    );
  });

  await step(page, who, 'Configurações pessoais sem itens de administração', async () => {
    await page.goto(`${BASE}/configuracoes`);
    await page.waitForLoadState('networkidle');
    await expectText(page, /Isa/);
  });

  await context.close();
}

// =============================================================================== ADMIN
{
  const { context, page } = await session('admin@demo.local', MOBILE);
  const who = 'admin';

  await step(page, who, 'Editar cifra e salvar', async () => {
    await page.goto(`${BASE}/repertorio/${SONG}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Editar cifra/ }).click();
    const box = page.getByLabel('Cifra (ChordPro)');
    await box.fill(`${await box.inputValue()}\n[G]Linha nova do [D]admin`);
    await page.getByRole('button', { name: 'Salvar cifra' }).click();
    await expectText(page, 'Cifra salva.');
  });

  await step(page, who, 'Definir tom oficial', async () => {
    await page.getByRole('button', { name: /Definir tom oficial/ }).click();
    await page.getByLabel('Tom oficial', { exact: true }).selectOption('A');
    await page.getByRole('button', { name: 'Salvar tom oficial' }).click();
    await expectText(page, 'Tom oficial salvo.');
  });

  await step(page, who, 'Histórico: restaurar uma versão', async () => {
    await page.goto(`${BASE}/repertorio/${SONG}/historico`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Restaurar' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Restaurar' }).click();
    await expectText(page, /Versão restaurada/);
  });

  await step(page, who, 'Integrantes com telefone', async () => {
    await page.goto(`${BASE}/integrantes`);
    await page.waitForLoadState('networkidle');
    await expectText(page, /Lucas/);
    const tel = await main(page).locator('a[href^="tel:"]').count();
    if (tel < 3) throw new Error(`${tel} telefones`);
    return `${tel} telefones`;
  });

  await step(page, who, 'Configurações', async () => {
    await page.goto(`${BASE}/configuracoes`);
    await page.waitForLoadState('networkidle');
    await expectText(page, /Ana/);
  });

  await step(page, who, 'Menu Mais com Configurações', async () => {
    await page.goto(`${BASE}/`);
    await page.getByRole('button', { name: /^Mais/ }).click();
    await page
      .getByRole('navigation', { name: 'Mais opções' })
      .getByRole('link', { name: 'Configurações' })
      .waitFor();
    await page.keyboard.press('Escape');
  });

  await context.close();
}

// =============================================================================== LÍDER
{
  const { context, page } = await session('lider@demo.local', DESKTOP);
  const who = 'lider';

  await step(page, who, 'Montar escala: validação de campos', async () => {
    await page.goto(`${BASE}/escalas/montar`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Salvar escala' }).click();
    await expectText(page, 'Informe o título.');
  });

  await step(page, who, 'Montar escala: novo evento com 2 pessoas', async () => {
    await page.getByLabel('Título').fill('Culto de teste E2E');
    const d = new Date(Date.now() + 5 * 86400000);
    const day = d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    await page.getByLabel('Início (horário de Brasília)').fill(`${day}T19:30`);
    const pessoas = page.getByLabel('Pessoa', { exact: true });
    const funcoes = page.getByLabel('Função', { exact: true });
    if ((await pessoas.count()) === 0)
      await page.getByRole('button', { name: 'Adicionar pessoa' }).click();
    await pessoas
      .nth(0)
      .selectOption({ label: 'Isa' })
      .catch(() => pessoas.nth(0).selectOption({ index: 1 }));
    await funcoes.nth(0).selectOption({ label: 'Bateria' });
    await page.getByRole('button', { name: 'Adicionar pessoa' }).click();
    await pessoas.nth(1).selectOption({ index: 1 });
    await funcoes.nth(1).selectOption({ label: 'Teclado' });
    await page.getByRole('button', { name: 'Salvar escala' }).click();
    await page.waitForURL(/\/escalas\/[0-9a-f-]{36}$/, { timeout: 15000 });
    await expectText(page, 'Culto de teste E2E');
    await expectText(page, '19:30');
  });

  await step(page, who, 'Desktop: Início', async () => {
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    await expectText(page, /Lucas/);
  });

  await context.close();
}

// Notificação do evento criado chega para a integrante
{
  const { context, page } = await session('integrante@demo.local', MOBILE);
  await step(page, 'integrante', 'Recebe notificação da nova escala', async () => {
    await page.goto(`${BASE}/notificacoes`);
    await page.waitForLoadState('networkidle');
    await expectText(page, /Culto de teste E2E/);
  });
  await context.close();
}

// =============================================================================== CADASTRO
// Integrante não vê a tela; admin cadastra; a pessoa nova entra com a senha provisória, é
// obrigada a trocar e depois entra normalmente; troca de senha em Configurações.
const NEW_EMAIL = 'cadastro-e2e@demo.local';
const NEW_PASSWORD = 'NovaSenha2026';
const NEXT_PASSWORD = 'OutraSenha2027';
let temporaryPassword = '';

{
  const { context, page } = await session('integrante@demo.local', MOBILE);
  const who = 'integrante';
  await step(page, who, 'Cadastro: integrante não vê o botão', async () => {
    await page.goto(`${BASE}/integrantes`);
    await page.waitForLoadState('networkidle');
    await expectText(page, /Lucas/);
    if (await page.getByRole('link', { name: 'Cadastrar integrante' }).count())
      throw new Error('botão Cadastrar integrante visível');
  });
  await step(page, who, 'Cadastro: tela bloqueada pelo endereço', async () => {
    await page.goto(`${BASE}/integrantes/cadastrar`);
    await expectText(page, 'Você não tem permissão para cadastrar integrantes.');
  });
  await context.close();
}

{
  const { context, page } = await session('admin@demo.local', MOBILE);
  const who = 'admin';
  await step(page, who, 'Cadastro: validação do formulário', async () => {
    await page.goto(`${BASE}/integrantes`);
    await page.getByRole('link', { name: 'Cadastrar integrante' }).click();
    await page.waitForURL(/\/integrantes\/cadastrar$/);
    await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
    await expectText(page, 'Informe o nome completo.');
    await expectText(page, 'Informe o e-mail.');
  });
  await step(page, who, 'Cadastro: admin cadastra e vê a senha provisória', async () => {
    await page.getByLabel('Nome completo').fill('Teste Cadastro E2E');
    await page.getByLabel('Como aparece no app (opcional)').fill('Novato');
    await page.getByLabel('E-mail').fill(NEW_EMAIL);
    await page.getByRole('checkbox', { name: 'Violão' }).check();
    await page.getByRole('radio', { name: /Integrante/ }).check();
    await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
    await expectText(page, /não será mostrada de novo/, 20000);
    temporaryPassword = (await page.getByLabel('Senha provisória').innerText()).trim();
    if (!/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/.test(temporaryPassword))
      throw new Error(`senha provisória em formato inesperado: ${temporaryPassword}`);
    const message = await page.getByLabel('Mensagem pronta para o WhatsApp').inputValue();
    for (const piece of [BASE, NEW_EMAIL, temporaryPassword])
      if (!message.includes(piece)) throw new Error(`mensagem sem "${piece}"`);
    const wa = await page.getByRole('link', { name: /Enviar pelo WhatsApp/ }).getAttribute('href');
    if (!wa?.startsWith('https://wa.me/?text=')) throw new Error(`link do WhatsApp: ${wa}`);
  });
  await step(
    page,
    who,
    'Cadastro: e-mail duplicado',
    async () => {
      await page.getByRole('button', { name: 'Cadastrar outra pessoa' }).click();
      await page.getByLabel('Nome completo').fill('Outra Pessoa');
      await page.getByLabel('E-mail').fill(NEW_EMAIL);
      await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
      await expectText(page, 'Já existe uma conta com este e-mail.', 20000);
    },
    { expectApiErrors: true },
  );
  await step(page, who, 'Cadastro: nova pessoa aparece em Integrantes', async () => {
    await page.goto(`${BASE}/integrantes`);
    await page.waitForLoadState('networkidle');
    await expectText(page, 'Novato');
  });
  await context.close();
}

{
  const { context, page } = await session(NEW_EMAIL, MOBILE, temporaryPassword);
  const who = 'novo';
  await step(page, who, 'Primeiro acesso: app bloqueado em "Defina sua senha"', async () => {
    await page.getByRole('heading', { name: 'Defina sua senha' }).waitFor();
    if (await page.getByRole('navigation', { name: 'Navegação principal' }).count())
      throw new Error('navegação visível antes de trocar a senha');
    await page.goto(`${BASE}/repertorio`);
    await page.getByRole('heading', { name: 'Defina sua senha' }).waitFor();
  });
  await step(page, who, 'Primeiro acesso: senha fraca é recusada', async () => {
    await page.getByLabel('Nova senha', { exact: true }).fill('curta1');
    await page.getByLabel('Repita a nova senha').fill('curta1');
    await page.getByRole('button', { name: 'Salvar e entrar' }).click();
    await expectText(page, 'Use pelo menos 10 caracteres.');
  });
  await step(page, who, 'Primeiro acesso: define a senha e entra no app', async () => {
    await page.getByLabel('Nova senha', { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel('Repita a nova senha').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Salvar e entrar' }).click();
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .first()
      .waitFor({ timeout: 15000 });
    await expectText(page, /Novato/);
  });
  await context.close();
}

{
  const { context, page } = await session(NEW_EMAIL, MOBILE, NEW_PASSWORD);
  const who = 'novo';
  await step(page, who, 'Entra normalmente com a senha nova', async () => {
    await expectText(page, /Novato/);
    if (await page.getByRole('heading', { name: 'Defina sua senha' }).count())
      throw new Error('pediu para definir a senha de novo');
  });
  await step(
    page,
    who,
    'Configurações: trocar senha (confere a atual)',
    async () => {
      await page.goto(`${BASE}/configuracoes`);
      await page.getByLabel('Senha atual').fill('senhaerrada123');
      await page.getByLabel('Nova senha', { exact: true }).fill(NEXT_PASSWORD);
      await page.getByLabel('Repita a nova senha').fill(NEXT_PASSWORD);
      await page.getByRole('button', { name: 'Trocar senha' }).click();
      await expectText(page, 'A senha atual está incorreta.');
      await page.getByLabel('Senha atual').fill(NEW_PASSWORD);
      await page.getByLabel('Nova senha', { exact: true }).fill(NEXT_PASSWORD);
      await page.getByLabel('Repita a nova senha').fill(NEXT_PASSWORD);
      await page.getByRole('button', { name: 'Trocar senha' }).click();
      await expectText(page, 'Senha alterada.');
    },
    { expectApiErrors: true },
  );
  await context.close();
}

{
  const { context, page } = await session(NEW_EMAIL, MOBILE, NEXT_PASSWORD);
  await step(page, 'novo', 'Entra com a senha trocada em Configurações', async () => {
    await expectText(page, /Novato/);
  });
  await context.close();
}

await browser.close();
writeFileSync(`${OUT}/fluxos/relatorio.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passos OK.`);
if (failed) process.exit(1);
