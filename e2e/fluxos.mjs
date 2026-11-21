// Roteiro de fluxos de docs/roteiro-de-teste.md com dados reais (Supabase local).
// Cada passo vira ✅/❌ no relatório; uma falha não interrompe os passos seguintes.
// Uso: BASE=http://127.0.0.1:5173 DEMO_PASSWORD=... node e2e/fluxos.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { makeWav } from './wav.mjs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'e2e-output';
const PASSWORD = process.env.DEMO_PASSWORD;
mkdirSync(`${OUT}/fluxos`, { recursive: true });

const SONG = '00000000-0000-4000-8000-000000000001';
const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1366, height: 900 } };

const results = [];
/** Evento "Culto de teste E2E" criado pelo admin (o modo culto da integrante abre ele). */
let eventE2E = '';
let shot = 0;
// Microfone falso (um bipe gerado pelo Chromium) para testar a gravação de ensaio.
const browser = await chromium.launch({
  ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

async function session(email, device, password = PASSWORD, { theme = 'system' } = {}) {
  const context = await browser.newContext({
    ...device,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'block',
    permissions: ['microphone'],
  });
  // Tema já escolhido: o modal "Como você prefere ver o app?" tem passo próprio (theme: null).
  if (theme)
    await context.addInitScript((t) => {
      try {
        if (!localStorage.getItem('louvor.theme')) localStorage.setItem('louvor.theme', t);
      } catch {
        // armazenamento indisponível
      }
    }, theme);
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
/** Links de músicas na lista do repertório (sem o botão "Nova música"). */
const songLinks = (page) =>
  main(page).locator('a[href^="/repertorio/"]:not([href="/repertorio/nova"])');
/** Só a lista (não os <option> dos filtros, que têm os mesmos nomes). */
const list = (page) => main(page).locator('ul');
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
/** Abre o menu ⋯ do cabeçalho e devolve o item pedido. */
const menuItem = async (page, name) => {
  await page.getByRole('button', { name: 'Mais opções', exact: true }).click();
  const item = page.getByRole('menuitem', { name, exact: true });
  await item.waitFor();
  return item;
};
/** Itens do menu ⋯ (abre, lê e fecha com Esc). */
const menuItems = async (page) => {
  await page.getByRole('button', { name: 'Mais opções', exact: true }).click();
  await page.getByRole('menu').waitFor();
  const items = await page.getByRole('menuitem').allInnerTexts();
  await page.keyboard.press('Escape');
  return items.map((t) => t.trim());
};
/** Campo da cifra no editor (o rótulo "Cifra" também é o da aba, que não é textbox). */
const chordsBox = (page) => page.getByRole('textbox', { name: 'Cifra', exact: true });
/** Escolhe uma opção de tema tocando no cartão (o <input> do rádio fica escondido). */
const pickTheme = (scope, name) => scope.getByText(name, { exact: true }).click();

// =============================================================================== TEMA (1º acesso)
{
  const { context, page } = await session('integrante@demo.local', MOBILE, PASSWORD, {
    theme: null,
  });
  const who = 'integrante';
  const dialog = page.getByRole('dialog', { name: 'Como você prefere ver o app?' });

  await step(page, who, 'Primeiro acesso: pergunta o tema (Automático marcado)', async () => {
    await dialog.waitFor();
    for (const name of ['Claro', 'Escuro', 'Automático'])
      await dialog.getByRole('radio', { name: new RegExp(name) }).waitFor();
    if (!(await dialog.getByRole('radio', { name: /Automático/ }).isChecked()))
      throw new Error('Automático não veio marcado');
    await pickTheme(dialog, 'Escuro');
    await poll(
      () => dialog.getByRole('radio', { name: /Escuro/ }).isChecked(),
      'Escuro não ficou marcado',
    );
    await dialog.getByRole('button', { name: 'Continuar' }).click();
    await dialog.waitFor({ state: 'hidden' });
    const saved = await page.evaluate(() => localStorage.getItem('louvor.theme'));
    if (saved !== 'dark') throw new Error(`tema salvo: ${saved}`);
    if (!(await page.evaluate(() => document.documentElement.classList.contains('dark'))))
      throw new Error('o app não ficou escuro');
  });

  await step(page, who, 'Segundo acesso: não pergunta de novo', async () => {
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    if (await dialog.isVisible()) throw new Error('o modal de tema apareceu de novo');
  });

  await context.close();
}

// =============================================================================== INTEGRANTE
{
  const { context, page } = await session('integrante@demo.local', MOBILE);
  const who = 'integrante';

  await step(page, who, 'Início com saudação e a próxima escala', async () => {
    await expectText(page, /Isa/);
    // Topo das telas principais: chama + "Louvor ADVOP" e o sino.
    await page.locator('header').getByText('Louvor ADVOP').first().waitFor();
    await page.getByRole('link', { name: /^Notificações:/ }).waitFor();
    const title = await page.title();
    if (title !== 'Ministério de Louvor · ADVOP') throw new Error(`título da aba: ${title}`);
    await expectText(page, /Sua próxima escala/i);
    await expectText(page, 'Ensaio geral');
    await expectText(page, /Você toca .*bateria/i);
    await main(page).getByRole('link', { name: 'Ver repertório' }).waitFor();
  });

  await step(page, who, 'Música do repertório do culto abre no tom do dia', async () => {
    await page.goto(`${BASE}/escalas/10000000-0000-4000-8000-000000000002`);
    await page.waitForLoadState('networkidle');
    await main(page).locator('a[href*="/repertorio/"][href*="tom="]').first().click();
    await page.waitForURL(/\/repertorio\/.+tom=/);
    await page.waitForLoadState('networkidle');
    return page.url().replace(BASE, '');
  });

  await step(page, who, 'Repertório lista 12 músicas', async () => {
    await page.goto(`${BASE}/repertorio`);
    await page.waitForLoadState('networkidle');
    const n = await songLinks(page).count();
    if (n !== 12) throw new Error(`${n} músicas na lista`);
    return `${n} músicas`;
  });

  await step(page, who, 'Busca sem acento "cantico"', async () => {
    await page.getByLabel('Buscar música').fill('cantico');
    await expectText(page, 'Cântico da Manhã');
    await poll(async () => (await songLinks(page).count()) === 1, 'esperava 1 resultado');
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

  await step(page, who, 'Menu ⋯: editar cifra, tom e dados; não vê Excluir', async () => {
    const items = await menuItems(page);
    for (const name of ['Editar letra', 'Editar cifra', 'Definir tom oficial', 'Editar dados'])
      if (!items.includes(name)) throw new Error(`sem "${name}" no menu: ${items.join(', ')}`);
    if (items.includes('Excluir')) throw new Error('Excluir visível para integrante');
    return items.join(', ');
  });

  await step(page, who, 'Editar letra e salvar', async () => {
    await (await menuItem(page, 'Editar letra')).click();
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

  await step(page, who, 'Agenda por mês: os 5 eventos (este mês e o próximo)', async () => {
    await page.goto(`${BASE}/agenda`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('navigation', { name: 'Mês' }).waitFor();
    // Os eventos do seed vão até 13 dias à frente: podem cair no mês seguinte.
    await page.waitForTimeout(500);
    const thisMonth = await main(page).innerText();
    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await page.waitForURL(/mes=/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const nextMonth = await main(page).innerText();
    const all = `${thisMonth}\n${nextMonth}`;
    const missing = [
      'Ensaio geral',
      'Culto de celebração',
      'Ensaio de vozes',
      'Culto da família',
      'Noite de louvor',
    ].filter((t) => !all.includes(t));
    if (missing.length) throw new Error(`faltando: ${missing.join(', ')}`);
    await page.getByRole('button', { name: 'Hoje' }).click();
    await page.waitForURL((u) => !u.search.includes('mes='));
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

  await step(page, who, 'Notificações (pelo sino): marcar todas como lidas', async () => {
    await page.goto(`${BASE}/`);
    await page.getByRole('link', { name: /^Notificações:/ }).click();
    await page.waitForURL(/\/notificacoes$/);
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

  await step(
    page,
    who,
    'Navegação inferior: Início, Escalas, Repertório, Agenda, Mais',
    async () => {
      await page.goto(`${BASE}/`);
      const nav = page.getByRole('navigation', { name: 'Navegação principal' });
      // allInnerTexts não espera: aguarda a barra aparecer antes de ler.
      await nav.getByRole('link', { name: 'Mais', exact: true }).waitFor();
      const links = (await nav.getByRole('link').allInnerTexts()).map((t) => t.trim());
      const expected = ['Início', 'Escalas', 'Repertório', 'Agenda', 'Mais'];
      if (links.join('|') !== expected.join('|')) throw new Error(`itens: ${links.join(', ')}`);
      await nav.getByRole('link', { name: 'Repertório' }).click();
      await page.waitForURL(/\/repertorio$/);
      await poll(
        async () =>
          (await nav.getByRole('link', { name: 'Repertório' }).getAttribute('aria-current')) ===
          'page',
        'Repertório não ficou marcado como atual',
      );
      return links.join(', ');
    },
  );

  // Mais: perfil, Integrantes, Comunicados, Configurações e, no fim, Sair (só aqui).
  await step(page, who, 'Tela Mais: itens sem administração e Sair só aqui', async () => {
    await page.goto(`${BASE}/`);
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Mais', exact: true })
      .click();
    await page.waitForURL(/\/mais$/);
    for (const item of ['Integrantes', 'Comunicados', 'Aparência', 'Minha conta'])
      await main(page)
        .getByRole('link', { name: new RegExp(item) })
        .waitFor();
    if (
      await main(page)
        .getByRole('link', { name: /Atividade recente/ })
        .count()
    )
      throw new Error('Atividade recente visível para integrante');
    await main(page).getByRole('button', { name: 'Sair' }).waitFor();
    for (const path of ['/', '/repertorio', '/escalas', '/configuracoes']) {
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState('networkidle');
      if (await page.getByRole('button', { name: 'Sair', exact: true }).count())
        throw new Error(`botão Sair em ${path}`);
    }
  });

  await step(page, who, 'Configurações: tema Escuro fica salvo; volta ao Automático', async () => {
    await page.goto(`${BASE}/configuracoes#aparencia`);
    await page.waitForLoadState('networkidle');
    const group = page.getByRole('radiogroup', { name: 'Tema' });
    await pickTheme(group, 'Escuro');
    await poll(
      () => page.evaluate(() => document.documentElement.classList.contains('dark')),
      'o app não ficou escuro',
    );
    const saved = await page.evaluate(() => localStorage.getItem('louvor.theme'));
    if (saved !== 'dark') throw new Error(`tema salvo: ${saved}`);
    await page.reload();
    await page.waitForLoadState('networkidle');
    if (!(await page.evaluate(() => document.documentElement.classList.contains('dark'))))
      throw new Error('o tema escuro não ficou depois de recarregar');
    await pickTheme(page.getByRole('radiogroup', { name: 'Tema' }), 'Automático');
    await poll(
      async () => (await page.evaluate(() => localStorage.getItem('louvor.theme'))) === 'system',
      'não voltou ao Automático',
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
    await (await menuItem(page, 'Editar cifra')).click();
    const box = chordsBox(page);
    await box.fill(`${await box.inputValue()}\n[G]Linha nova do [D]admin`);
    await page.getByRole('button', { name: 'Salvar cifra' }).click();
    await expectText(page, 'Cifra salva.');
  });

  await step(page, who, 'Definir tom oficial', async () => {
    await (await menuItem(page, 'Definir tom oficial')).click();
    await page.getByLabel('Tom oficial', { exact: true }).selectOption('A');
    await page.getByRole('button', { name: 'Salvar tom oficial' }).click();
    await expectText(page, 'Tom oficial salvo.');
  });

  await step(page, who, 'Histórico: restaurar uma alteração', async () => {
    await page.goto(`${BASE}/repertorio/${SONG}/historico`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Restaurar' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Restaurar' }).click();
    await expectText(page, /Conteúdo restaurado/);
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

  await step(page, who, 'Tela Mais com itens de administração', async () => {
    await page.goto(`${BASE}/mais`);
    await page.waitForLoadState('networkidle');
    for (const item of ['Montar escala', 'Cadastrar integrante', 'Atividade recente'])
      await main(page)
        .getByRole('link', { name: new RegExp(item) })
        .waitFor();
  });

  await step(page, who, 'Menu ⋯ da música mostra Excluir para o admin', async () => {
    await page.goto(`${BASE}/repertorio/${SONG}`);
    await page.waitForLoadState('networkidle');
    const items = await menuItems(page);
    for (const name of ['Editar cifra', 'Editar letra', 'Histórico', 'Excluir'])
      if (!items.includes(name)) throw new Error(`sem "${name}": ${items.join(', ')}`);
    return items.join(', ');
  });

  await context.close();
}

// =============================================================================== LUCAS (ex-líder)
{
  const { context, page } = await session('lider@demo.local', MOBILE);
  await step(page, 'lucas', 'Ex-líder agora é integrante: não monta escala', async () => {
    await page.goto(`${BASE}/escalas/montar`);
    await expectText(page, 'Você não tem permissão para montar escalas.');
  });
  await context.close();
}

// =============================================================================== ADMIN (desktop)
{
  const { context, page } = await session('admin@demo.local', DESKTOP);
  const who = 'admin';

  await step(page, who, 'Montar escala: filtro Cantores/Instrumentistas', async () => {
    await page.goto(`${BASE}/escalas/montar`);
    await page.waitForLoadState('networkidle');
    const options = () =>
      page.getByLabel('Pessoa', { exact: true }).first().locator('option').allInnerTexts();
    await page.getByRole('radio', { name: 'Cantores' }).click();
    const cantores = await options();
    if (cantores.includes('Isa') || !cantores.includes('Lucas'))
      throw new Error(`Cantores: ${cantores.join(', ')}`);
    await page.getByRole('radio', { name: 'Instrumentistas' }).click();
    const instr = await options();
    if (!instr.includes('Isa')) throw new Error(`Instrumentistas: ${instr.join(', ')}`);
    await page.getByRole('radio', { name: 'Todos' }).click();
    return `cantores: ${cantores.filter((o) => o !== 'Escolha…').join(', ')}`;
  });

  await step(page, who, 'Montar escala: validação de campos', async () => {
    await page.goto(`${BASE}/escalas/montar`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /^Criar evento/ }).click();
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
    await page.getByRole('button', { name: 'Criar evento e salvar escala' }).click();
    // Passo 3: repertório (evento e equipe já gravados numa transação só).
    await page.waitForURL(/\/escalas\/[0-9a-f-]{36}\/repertorio\?montar=1$/, { timeout: 15000 });
    await expectText(page, /Passo 3/);
  });

  await step(page, who, 'Montar escala: repertório com 2 músicas, ordem e tom do dia', async () => {
    const search = page.getByLabel('Buscar no repertório');
    for (const title of ['Doxologia', 'Santo! Santo! Santo!']) {
      await search.fill(title);
      await page
        .getByRole('list', { name: 'Resultado da busca' })
        .getByRole('button', { name: new RegExp(`Adicionar.*${title.replace(/[!]/g, '.')}`) })
        .first()
        .click();
    }
    const order = page.getByRole('list', { name: 'Ordem do repertório' });
    await order.getByRole('group').nth(1).waitFor();
    // Santo! primeiro (sobe), tom do dia E na segunda música.
    await page.getByRole('button', { name: 'Subir Santo! Santo! Santo!' }).click();
    await order.getByRole('group').nth(1).getByLabel('Tom do dia').selectOption('A');
    await page.getByRole('button', { name: 'Salvar repertório' }).click();
    await page.waitForURL(/\/escalas\/[0-9a-f-]{36}#repertorio$/, { timeout: 15000 });
    eventE2E = new URL(page.url()).pathname.split('/').pop();
    await expectText(page, 'Culto de teste E2E');
    await expectText(page, '19:30');
    const region = main(page).getByRole('region', { name: 'Repertório' });
    const first = await region.getByRole('link').first().innerText();
    if (!/Santo/.test(first)) throw new Error(`primeira música: ${first}`);
    return eventE2E;
  });

  await step(page, who, 'Desktop: Início', async () => {
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    await expectText(page, /Ana/);
  });

  await context.close();
}

// =============================================================================== NOVA MÚSICA
// Cifra FICTÍCIA no formato dos sites (acordes em cima da letra, partes entre colchetes).
const NEW_SONG = 'Canção de Teste E2E (exemplo)';
const PASTED = [
  '[Intro] G  D  Em  C',
  '',
  '[Primeira Parte]',
  'G'.padEnd(10) + 'D/F#',
  'Luz que vem de manhã',
  'Em7'.padEnd(10) + 'C7M',
  'Paz no coração',
  '',
  '[Refrão]',
  'C'.padEnd(9) + 'D7(9)',
  'Canto de alegria',
  'G',
].join('\n');
let newSongPath = '';

{
  const { context, page } = await session('integrante@demo.local', MOBILE);
  const who = 'integrante';

  await step(
    page,
    who,
    'Nova música: cola a cifra, vê formato, pré-visualização e tom',
    async () => {
      await page.goto(`${BASE}/repertorio`);
      await page.getByRole('link', { name: 'Nova música' }).click();
      await page.waitForURL(/\/repertorio\/nova$/);
      await page.getByLabel('Título').fill(NEW_SONG);
      await page.getByRole('textbox', { name: 'Cole a cifra ou a letra' }).fill(PASTED);
      await expectText(page, /acordes em cima da letra/);
      const preview = page.getByRole('region', { name: 'Pré-visualização' });
      await preview.getByText('Refrão').waitFor();
      await preview.getByText('D7(9)').waitFor();
      // Tom sugerido pelo primeiro acorde (G), editável.
      await expectText(page, /Sugerido pelo primeiro acorde \(G\)/);
      const key = await page.getByRole('combobox', { name: 'Tom', exact: true }).inputValue();
      if (key !== 'G') throw new Error(`tom sugerido: ${key}`);
    },
  );

  await step(page, who, 'Nova música: salva (letra gerada da cifra) e abre', async () => {
    await page.getByRole('button', { name: 'Salvar música' }).click();
    await page.waitForURL(/\/repertorio\/[0-9a-f-]{36}$/, { timeout: 15000 });
    newSongPath = new URL(page.url()).pathname;
    await page.getByRole('heading', { name: NEW_SONG }).waitFor();
    await page.getByRole('tab', { name: 'Letra' }).click();
    await expectText(page, 'Luz que vem de manhã');
    await page.getByRole('tab', { name: 'Cifra' }).click();
    return newSongPath;
  });

  await step(page, who, 'Nova música: transpõe', async () => {
    const tom = page.getByRole('combobox', { name: 'Tom', exact: true });
    const antes = await tom.inputValue();
    await page.getByRole('button', { name: 'Subir meio tom' }).click();
    await poll(async () => (await tom.inputValue()) !== antes, 'tom não mudou');
    return `${antes} → ${await tom.inputValue()}`;
  });

  await step(page, who, 'Nova música: integrante edita a cifra', async () => {
    await page.goto(`${BASE}${newSongPath}`);
    await (await menuItem(page, 'Editar cifra')).click();
    const box = chordsBox(page);
    await box.fill(`${await box.inputValue()}\n[C]Linha nova da [G]Isa`);
    await page.getByRole('button', { name: 'Salvar cifra' }).click();
    await expectText(page, 'Cifra salva.');
  });

  await step(page, who, 'Nova música: integrante define o tom oficial', async () => {
    await (await menuItem(page, 'Definir tom oficial')).click();
    await page.getByLabel('Tom oficial', { exact: true }).selectOption('A');
    await page.getByRole('button', { name: 'Salvar tom oficial' }).click();
    await expectText(page, 'Tom oficial salvo.');
  });

  await step(page, who, 'Nova música: integrante edita os dados', async () => {
    await (await menuItem(page, 'Editar dados')).click();
    await page.getByLabel('Artista / autor (opcional)').fill('Autor fictício');
    await page.getByRole('button', { name: 'Salvar dados' }).click();
    await expectText(page, 'Dados da música salvos.');
    await expectText(page, 'Autor fictício');
    if ((await menuItems(page)).includes('Excluir')) throw new Error('Excluir visível');
  });

  await step(
    page,
    who,
    'Atividade recente bloqueada para integrante',
    async () => {
      await page.goto(`${BASE}/atividade`);
      await expectText(page, 'Você não tem permissão para ver a atividade de todo o repertório.');
    },
    { expectApiErrors: true },
  );

  await context.close();
}

{
  const { context, page } = await session('admin@demo.local', MOBILE);
  const who = 'admin';

  await step(page, who, 'Atividade recente: vê as alterações da integrante', async () => {
    await page.goto(`${BASE}/atividade`);
    await page.waitForLoadState('networkidle');
    // Só a lista: os <option> dos filtros têm os mesmos nomes e não ficam "visíveis".
    await list(page).getByText(NEW_SONG).first().waitFor();
    await list(page).getByText('Editou a cifra').first().waitFor();
    await page.getByLabel('Pessoa').selectOption({ label: 'Isa' });
    await page.waitForLoadState('networkidle');
    await poll(
      async () =>
        !(await list(page)
          .getByText(/^Ana ·/)
          .count()),
      'filtro por pessoa ainda mostra a Ana',
    );
    await list(page)
      .getByText(/^Isa ·/)
      .first()
      .waitFor();
  });

  await step(page, who, 'Atividade recente → histórico → restaurar', async () => {
    await list(page).getByRole('link').filter({ hasText: NEW_SONG }).first().click();
    await page.waitForURL(/\/historico$/);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Restaurar' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Restaurar' }).click();
    await expectText(page, /Conteúdo restaurado/);
  });

  await step(page, who, 'Excluir música pelo menu ⋯ (só admin)', async () => {
    await page.goto(`${BASE}${newSongPath}`);
    await page.waitForLoadState('networkidle');
    await (await menuItem(page, 'Excluir')).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
    await expectText(page, /excluída/);
    await page.goto(`${BASE}/repertorio`);
    await page.getByLabel('Buscar música').fill('Teste E2E');
    await expectText(page, 'Nenhuma música encontrada');
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
  await step(page, 'integrante', 'Modo culto: 1ª música no tom do dia e "Próxima"', async () => {
    if (!eventE2E) throw new Error('o evento de teste não foi criado');
    await page.goto(`${BASE}/escalas/${eventE2E}`);
    await page.waitForLoadState('networkidle');
    await main(page).getByRole('region', { name: 'Repertório' }).getByRole('link').first().click();
    await page.waitForURL(/\/repertorio\/.+evento=/);
    await page.getByText(/^1 de 2 · Culto de teste E2E/).waitFor();
    await page
      .getByRole('navigation', { name: 'Sequência do repertório' })
      .getByRole('button', { name: /Próxima/ })
      .click();
    await page.getByText(/^2 de 2 · Culto de teste E2E em A$/).waitFor();
    const tom = await page.getByRole('combobox', { name: 'Tom', exact: true }).inputValue();
    if (tom !== 'A') throw new Error(`tom do dia: ${tom}`);
    return page.url().replace(BASE, '');
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
    // Liberado: o app abre onde a pessoa estava (aqui, /repertorio).
    if (await page.getByRole('heading', { name: 'Defina sua senha' }).count())
      throw new Error('continua bloqueado depois de salvar');
    await page.goto(`${BASE}/`);
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
      await page.waitForLoadState('networkidle');
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

// =============================================================================== REDEFINIR SENHA
// Integrante não vê o botão nem a tela de funções; admin redefine a senha do "Novato" (senha
// provisória mostrada uma vez); a pessoa entra com ela e é obrigada a trocar. Funções do
// ministério: nova função exige o grupo (pendência 34).
const RESET_PASSWORD = 'TerceiraSenha2028';
let resetTemporary = '';

{
  const { context, page } = await session('integrante@demo.local', MOBILE);
  const who = 'integrante';
  await step(page, who, 'Redefinir senha: integrante não vê o botão', async () => {
    await page.goto(`${BASE}/integrantes`);
    await page.waitForLoadState('networkidle');
    await expectText(page, /Novato/);
    if (
      await main(page)
        .getByRole('button', { name: /Redefinir senha/ })
        .count()
    )
      throw new Error('botão Redefinir senha visível para integrante');
    if (await page.getByRole('link', { name: 'Funções do ministério' }).count())
      throw new Error('link Funções do ministério visível para integrante');
  });
  await step(page, who, 'Funções: tela bloqueada pelo endereço', async () => {
    await page.goto(`${BASE}/integrantes/funcoes`);
    await expectText(page, 'Você não tem permissão para gerenciar as funções do ministério.');
  });
  await context.close();
}

{
  const { context, page } = await session('admin@demo.local', MOBILE);
  const who = 'admin';
  await step(page, who, 'Redefinir senha: sem botão no próprio cartão', async () => {
    await page.goto(`${BASE}/integrantes`);
    await page.waitForLoadState('networkidle');
    await expectText(page, /Novato/);
    const mine = main(page)
      .locator('li')
      .filter({ has: page.getByText('você', { exact: true }) });
    if ((await mine.count()) !== 1) throw new Error(`cartão próprio: ${await mine.count()}`);
    if (await mine.getByRole('button', { name: /Redefinir senha/ }).count())
      throw new Error('botão Redefinir senha no próprio cartão');
  });
  await step(page, who, 'Redefinir senha: cancelar não muda nada', async () => {
    await main(page).getByRole('button', { name: 'Redefinir senha de Novato' }).click();
    const dialog = page.getByRole('dialog', { name: 'Redefinir a senha de Novato?' });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await dialog.waitFor({ state: 'hidden' });
  });
  await step(page, who, 'Redefinir senha: admin redefine e vê a senha provisória', async () => {
    await main(page).getByRole('button', { name: 'Redefinir senha de Novato' }).click();
    const confirm = page.getByRole('dialog', { name: 'Redefinir a senha de Novato?' });
    await confirm.getByRole('button', { name: 'Redefinir senha', exact: true }).click();
    const result = page.getByRole('dialog', { name: /Senha de Novato redefinida/ });
    await result.waitFor({ timeout: 20000 });
    await result.getByText(/não será mostrada de novo/).waitFor();
    resetTemporary = (await result.getByLabel('Senha provisória').innerText()).trim();
    if (!/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/.test(resetTemporary))
      throw new Error(`senha provisória em formato inesperado: ${resetTemporary}`);
    const message = await result.getByLabel('Mensagem pronta para o WhatsApp').inputValue();
    for (const piece of [BASE, NEW_EMAIL, resetTemporary, 'redefinida'])
      if (!message.includes(piece)) throw new Error(`mensagem sem "${piece}"`);
    const wa = await result
      .getByRole('link', { name: /Enviar pelo WhatsApp/ })
      .getAttribute('href');
    if (!wa?.startsWith('https://wa.me/?text=')) throw new Error(`link do WhatsApp: ${wa}`);
    await result.getByRole('button', { name: 'Fechar' }).click();
    await result.waitFor({ state: 'hidden' });
  });

  await step(page, who, 'Funções: grupo obrigatório ao cadastrar', async () => {
    await page.goto(`${BASE}/integrantes`);
    await page.getByRole('link', { name: 'Funções do ministério' }).click();
    await page.waitForURL(/\/integrantes\/funcoes$/);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Adicionar função' }).click();
    await expectText(page, 'Informe o nome da função.');
    await expectText(page, 'Escolha o grupo.');
  });
  await step(page, who, 'Funções: cadastra função vocal (Cantores)', async () => {
    await page.getByLabel('Nome da função').fill('Ministro(a) E2E');
    await page.getByRole('radio', { name: /Cantores/ }).check();
    await page.getByRole('button', { name: 'Adicionar função' }).click();
    const select = page.getByLabel('Grupo de Ministro(a) E2E');
    await select.waitFor({ timeout: 10000 });
    const value = await select.inputValue();
    if (value !== 'vocal') throw new Error(`grupo salvo: ${value}`);
  });
  await step(
    page,
    who,
    'Funções: nome repetido é recusado',
    async () => {
      await page.getByLabel('Nome da função').fill('Ministro(a) E2E');
      await page.getByRole('radio', { name: /Instrumentistas/ }).check();
      await page.getByRole('button', { name: 'Adicionar função' }).click();
      await expectText(page, 'Já existe uma função com esse nome.');
    },
    { expectApiErrors: true },
  );
  await step(page, who, 'Funções: muda o grupo de uma função existente', async () => {
    await page.getByLabel('Grupo de Ministro(a) E2E').selectOption('instrumental');
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await poll(
      async () =>
        (await page.getByLabel('Grupo de Ministro(a) E2E').inputValue()) === 'instrumental',
      'grupo não ficou salvo',
    );
  });
  await context.close();
}

if (resetTemporary) {
  const { context, page } = await session(NEW_EMAIL, MOBILE, resetTemporary);
  const who = 'novo';
  await step(
    page,
    who,
    'Senha redefinida: entra com a provisória e é obrigado a trocar',
    async () => {
      await page.getByRole('heading', { name: 'Defina sua senha' }).waitFor();
      if (await page.getByRole('navigation', { name: 'Navegação principal' }).count())
        throw new Error('navegação visível antes de trocar a senha');
    },
  );
  await step(page, who, 'Senha redefinida: define a nova senha e entra', async () => {
    await page.getByLabel('Nova senha', { exact: true }).fill(RESET_PASSWORD);
    await page.getByLabel('Repita a nova senha').fill(RESET_PASSWORD);
    await page.getByRole('button', { name: 'Salvar e entrar' }).click();
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .first()
      .waitFor({ timeout: 15000 });
    await page.goto(`${BASE}/`);
    await expectText(page, /Novato/);
  });
  await context.close();
}

// =============================================================================== ÁUDIO
const ENSAIO_GERAL = '10000000-0000-4000-8000-000000000001';
const playerOf = (page) => page.getByTestId('audio-player').first();
const attr = (loc, name) => loc.getAttribute(name);
/** Diálogo "Dê um nome a este áudio" (abre depois de cada envio). */
const nameDialog = (page) => page.getByRole('dialog', { name: 'Dê um nome a este áudio' });
const skipNaming = async (page) => {
  const dialog = nameDialog(page);
  await dialog.waitFor({ timeout: 20000 });
  await dialog.getByRole('button', { name: 'Agora não' }).click();
  await dialog.waitFor({ state: 'hidden' });
};

{
  const { context, page } = await session('integrante@demo.local', MOBILE);
  const who = 'integrante';

  await step(page, who, 'Áudio de referência: recusa arquivo acima de 45 MB', async () => {
    await page.goto(`${BASE}/repertorio/${SONG}`);
    await page.waitForLoadState('networkidle');
    // Arquivo grande em disco temporário (fora dos artefatos do CI).
    const big = join(tmpdir(), 'grande-ficticio.wav');
    writeFileSync(big, makeWav({ minBytes: 46 * 1024 * 1024 }));
    await page.getByLabel('Arquivo de áudio de referência').setInputFiles(big);
    await expectText(page, /o limite é 45 MB/);
  });

  await step(page, who, 'Áudio de referência: envia (fictício) e aparece com player', async () => {
    await page.getByLabel('Arquivo de áudio de referência').setInputFiles({
      name: 'referencia-ficticia.wav',
      mimeType: 'audio/wav',
      buffer: makeWav({ seconds: 6 }),
    });
    // Pede o nome logo depois de enviar: usa a sugestão "Voz guia".
    const dialog = nameDialog(page);
    await dialog.waitFor({ timeout: 20000 });
    await dialog.getByRole('button', { name: 'Voz guia' }).click();
    await dialog.getByRole('button', { name: 'Salvar nome' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await playerOf(page).waitFor({ timeout: 20000 });
    await expectText(page, 'Voz guia');
  });

  await step(page, who, 'Player: toca com SoundTouch (tom e velocidade no aparelho)', async () => {
    const player = playerOf(page);
    await player.getByRole('button', { name: /^Tocar/ }).click();
    await poll(
      async () => (await attr(player, 'data-engine')) !== 'parado',
      'motor de áudio não iniciou',
    );
    const engine = await attr(player, 'data-engine');
    if (engine !== 'soundtouch') throw new Error(`motor: ${engine}`);
    await poll(
      () =>
        page.evaluate(
          () =>
            (document.querySelector('[data-testid="audio-player"] audio')?.currentTime ?? 0) > 0.3,
        ),
      'o áudio não avançou',
    );
    return engine;
  });

  await step(page, who, 'Player: velocidade 75% sem mudar o tom', async () => {
    const player = playerOf(page);
    // Chip do dock: 100% → 75% → 50%.
    await player.getByRole('button', { name: /^Velocidade/ }).click();
    await poll(async () => (await attr(player, 'data-speed')) === '0.75', 'velocidade não mudou');
    const rate = await page.evaluate(
      () => document.querySelector('[data-testid="audio-player"] audio')?.playbackRate,
    );
    if (rate !== 0.75) throw new Error(`playbackRate ${rate}`);
  });

  await step(page, who, 'Player: tom acompanha a cifra e pode ser ajustado à mão', async () => {
    const player = playerOf(page);
    const before = Number(await attr(player, 'data-pitch'));
    await page.getByRole('button', { name: 'Subir meio tom', exact: true }).click(); // barra de tom da CIFRA
    await poll(
      async () => Number(await attr(player, 'data-pitch')) === before + 1,
      'tom do áudio não acompanhou a cifra',
    );
    // Ajustes do áudio (abaixo dos áudios de referência).
    await page.getByRole('button', { name: 'Descer meio tom do áudio' }).click();
    await page.getByRole('button', { name: 'Descer meio tom do áudio' }).click();
    await poll(
      async () => Number(await attr(player, 'data-pitch')) === before - 1,
      'ajuste manual não funcionou',
    );
    const follow = page.getByRole('checkbox', { name: /Acompanhar o tom da cifra/ });
    if (await follow.isChecked()) throw new Error('ajuste manual deveria desligar o acompanhar');
    await player.getByRole('button', { name: /^Pausar/ }).click();
    return `pitch ${before} → ${before - 1}`;
  });

  await step(page, who, 'Gravar na música: grava com o microfone e dá nome', async () => {
    await page.goto(`${BASE}/repertorio/${SONG}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Gravar', exact: true }).click();
    await poll(
      async () => /0:0[3-9]/.test(await page.getByTestId('cronometro').innerText()),
      'cronômetro parado',
      15000,
    );
    await page.getByRole('button', { name: 'Pausar' }).click();
    await page.getByRole('button', { name: 'Retomar' }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Parar' }).click();
    const pendente = page.getByRole('list', { name: 'Gravações não enviadas' });
    await pendente.getByRole('button', { name: 'Enviar' }).click();
    const dialog = nameDialog(page);
    await dialog.waitFor({ timeout: 30000 });
    await dialog.getByLabel('Nome do áudio').fill('Arranjo E2E');
    await dialog.getByRole('button', { name: 'Salvar nome' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await poll(async () => (await pendente.count()) === 0, 'gravação ficou pendente', 15000);
    await expectText(page, 'Arranjo E2E');
  });

  await step(page, who, 'Gravar na música: ouve e o tom acompanha a cifra', async () => {
    // Escolhe a gravação para o player do dock.
    await main(page)
      .getByRole('button', { name: /(Ouvir no player|No player).*Arranjo E2E/ })
      .click();
    const player = playerOf(page);
    await poll(
      async () => /Arranjo E2E/.test(await player.innerText()),
      'o player não trocou para a gravação',
    );
    await player.getByRole('button', { name: /^Tocar/ }).click();
    await poll(
      async () => (await attr(player, 'data-engine')) !== 'parado',
      'motor de áudio não iniciou',
    );
    await poll(
      () => player.evaluate((el) => (el.querySelector('audio')?.currentTime ?? 0) > 0.3),
      'a gravação não tocou',
    );
    const before = Number(await attr(player, 'data-pitch'));
    await page.getByRole('button', { name: 'Subir meio tom', exact: true }).click();
    await poll(
      async () => Number(await attr(player, 'data-pitch')) === before + 1,
      'tom da gravação não acompanhou a cifra',
    );
    await player.getByRole('button', { name: /^Pausar/ }).click();
    return `motor ${await attr(player, 'data-engine')}, tom ${before} → ${before + 1}`;
  });

  await step(page, who, 'Gravar na música: autora renomeia o áudio', async () => {
    await main(page).getByRole('button', { name: 'Renomear Arranjo E2E' }).click();
    const dialog = page.getByRole('dialog', { name: 'Renomear áudio' });
    await dialog.waitFor();
    await dialog.getByLabel('Nome do áudio').fill('Arranjo final');
    await dialog.getByRole('button', { name: 'Salvar nome' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await expectText(page, 'Arranjo final');
  });

  await step(page, who, 'Áudio de referência: terceiro áudio (arquivo) sem nome', async () => {
    await page.getByLabel('Arquivo de áudio de referência').setInputFiles({
      name: 'terceiro-ficticio.wav',
      mimeType: 'audio/wav',
      buffer: makeWav({ seconds: 2 }),
    });
    await skipNaming(page);
    // Sem nome: aparece pela posição (o mais novo é o 3º).
    await expectText(page, /Áudio 3/);
  });

  await step(page, who, 'Áudio de referência: o quarto é recusado (limite de 3)', async () => {
    await expectText(page, 'Esta música já tem 3 áudios de referência');
    if (!(await page.getByRole('button', { name: 'Gravar', exact: true }).isDisabled()))
      throw new Error('Gravar continua liberado com 3 áudios');
    if (!(await page.getByRole('button', { name: 'Enviar áudio' }).isDisabled()))
      throw new Error('Enviar áudio continua liberado com 3 áudios');
    const players = await main(page)
      .getByRole('button', { name: /(Ouvir no player|No player)/ })
      .count();
    if (players !== 3) throw new Error(`${players} áudios na lista`);
  });

  await step(page, who, 'Gravar ensaio: grava, pausa, retoma, para e envia', async () => {
    await page.goto(`${BASE}/escalas/${ENSAIO_GERAL}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Gravar ensaio' }).click();
    await poll(
      async () => /0:0[2-9]/.test(await page.getByTestId('cronometro').innerText()),
      'cronômetro parado',
      15000,
    );
    await page.getByRole('button', { name: 'Pausar' }).click();
    const paused = await page.getByTestId('cronometro').innerText();
    await page.waitForTimeout(1500);
    if ((await page.getByTestId('cronometro').innerText()) !== paused)
      throw new Error('cronômetro andou pausado');
    await page.getByRole('button', { name: 'Retomar' }).click();
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Parar' }).click();
    const pendente = page.getByRole('list', { name: 'Gravações não enviadas' });
    await pendente.getByRole('button', { name: 'Enviar' }).click();
    await poll(async () => (await pendente.count()) === 0, 'gravação não foi enviada', 30000);
    await skipNaming(page);
    await page
      .getByText(/Gravação 1/)
      .first()
      .waitFor({ timeout: 15000 });
    await expectText(page, /Isa/);
  });

  await step(page, who, 'Gravar ensaio: app recarregado no meio não perde a gravação', async () => {
    await page.getByRole('button', { name: 'Gravar ensaio' }).click();
    await poll(
      async () => /0:0[6-9]/.test(await page.getByTestId('cronometro').innerText()),
      'cronômetro parado',
      20000,
    );
    await page.reload(); // simula o app fechando no meio (os pedaços já estão no IndexedDB)
    await page.waitForLoadState('networkidle');
    const pendente = page.getByRole('list', { name: 'Gravações não enviadas' });
    await pendente.waitFor({ timeout: 15000 });
    await pendente.getByRole('button', { name: 'Enviar' }).click();
    await poll(
      async () => (await pendente.count()) === 0,
      'gravação recuperada não foi enviada',
      30000,
    );
    await skipNaming(page);
    await page
      .getByText(/Gravação 2/)
      .first()
      .waitFor({ timeout: 15000 });
  });

  await context.close();
}

{
  const { context, page } = await session('lider@demo.local', MOBILE);
  await step(page, 'lucas', 'Gravações: ouve, mas não apaga o áudio de outra pessoa', async () => {
    await page.goto(`${BASE}/escalas/${ENSAIO_GERAL}`);
    await page.waitForLoadState('networkidle');
    await page
      .getByText(/Gravação 1/)
      .first()
      .waitFor();
    if (await page.getByRole('button', { name: /^Apagar Gravação/ }).count())
      throw new Error('botão Apagar visível para quem não é autor');
    await playerOf(page).waitFor();
  });
  await context.close();
}

{
  const { context, page } = await session('admin@demo.local', MOBILE);
  await step(page, 'admin', 'Gravações: admin pode apagar áudio de qualquer pessoa', async () => {
    await page.goto(`${BASE}/escalas/${ENSAIO_GERAL}`);
    await page.waitForLoadState('networkidle');
    await page
      .getByRole('button', { name: /^Apagar Gravação/ })
      .first()
      .waitFor();
  });
  await step(page, 'admin', 'Configurações: espaço usado do 1 GB', async () => {
    await page.goto(`${BASE}/configuracoes`);
    await page.waitForLoadState('networkidle');
    await expectText(page, 'Espaço dos áudios');
    await expectText(page, /de 1 GB usados/);
  });
  await context.close();
}

{
  const { context, page } = await session('integrante@demo.local', MOBILE);
  await step(page, 'integrante', 'Configurações: integrante não vê o espaço usado', async () => {
    await page.goto(`${BASE}/configuracoes`);
    await page.waitForLoadState('networkidle');
    if (await page.getByText('Espaço dos áudios').count()) throw new Error('card visível');
  });
  await context.close();
}

await browser.close();
writeFileSync(`${OUT}/fluxos/relatorio.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passos OK.`);
if (failed) process.exit(1);
