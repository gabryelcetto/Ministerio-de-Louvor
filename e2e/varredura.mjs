// Varredura: login em cada perfil, visita cada rota (celular e desktop), coleta erros de
// console, respostas >= 400 da API e mensagens de erro na tela; salva capturas.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'e2e-output';
const PASSWORD = process.env.DEMO_PASSWORD;
const ONLY = process.env.ONLY?.split(',');
mkdirSync(OUT, { recursive: true });

const users = {
  admin: 'admin@demo.local',
  lider: 'lider@demo.local',
  integrante: 'integrante@demo.local',
};
const viewports = {
  celular: { width: 390, height: 844, isMobile: true, hasTouch: true },
  desktop: { width: 1366, height: 900 },
};
const ids = {
  song: '00000000-0000-4000-8000-000000000001',
  songPending: '00000000-0000-4000-8000-000000000005',
  event: '10000000-0000-4000-8000-000000000002',
};
const routes = [
  ['inicio', '/'],
  ['escalas', '/escalas'],
  ['evento', `/escalas/${ids.event}`],
  ['evento-inexistente', '/escalas/99999999-0000-4000-8000-000000000000'],
  ['agenda', '/agenda'],
  ['repertorio', '/repertorio'],
  ['musica', `/repertorio/${ids.song}`],
  ['musica-pendente', `/repertorio/${ids.songPending}`],
  ['historico', `/repertorio/${ids.song}/historico`],
  ['montar', '/escalas/montar'],
  ['notificacoes', '/notificacoes'],
  ['comunicados', '/comunicados'],
  ['integrantes', '/integrantes'],
  ['configuracoes', '/configuracoes'],
];

const report = [];
const browser = await chromium.launch(
  process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {},
);
for (const [role, email] of Object.entries(users)) {
  for (const [vpName, vp] of Object.entries(viewports)) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    const issues = [];
    page.on('console', (m) => {
      if (m.type() === 'error') issues.push(`console: ${m.text()}`);
    });
    page.on('pageerror', (e) => issues.push(`pageerror: ${e.message}`));
    page.on('response', async (r) => {
      if (r.url().includes(':54321') && r.status() >= 400) {
        let body = '';
        try {
          body = (await r.text()).slice(0, 300);
        } catch {}
        issues.push(
          `api ${r.status()} ${r.request().method()} ${r.url().replace(/^.*:54321/, '')} ${body}`,
        );
      }
    });

    await page.goto(`${BASE}/login`);
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });

    for (const [name, path] of routes) {
      if (ONLY && !ONLY.includes(name)) continue;
      const before = issues.length;
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(400);
      const text = await page
        .locator('main')
        .innerText()
        .catch(() => '');
      const errorOnScreen =
        /Não foi possível|Tentar de novo|Algo deu errado|undefined|NaN|Invalid/i.test(text);
      // Compara com a largura configurada: no modo celular a janela "cresce" junto com a página
      // (como o zoom automático do celular), então window.innerWidth esconderia o problema.
      const scrollX = await page.evaluate(
        (width) => document.documentElement.scrollWidth > width + 1,
        vp.width,
      );
      await page.screenshot({ path: `${OUT}/${role}-${vpName}-${name}.png`, fullPage: true });
      const entry = {
        role,
        vp: vpName,
        route: name,
        issues: issues.slice(before),
        errorOnScreen,
        horizontalScroll: scrollX,
        excerpt: text.replace(/\s+/g, ' ').slice(0, 220),
      };
      report.push(entry);
      const flag = entry.issues.length || errorOnScreen || scrollX ? '❌' : '✅';
      console.log(
        `${flag} ${role}/${vpName}/${name}${entry.issues.length ? ' :: ' + entry.issues.join(' | ') : ''}${errorOnScreen ? ' :: ERRO NA TELA: ' + entry.excerpt : ''}${scrollX ? ' :: ROLAGEM LATERAL' : ''}`,
      );
    }
    await context.close();
  }
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
const bad = report.filter((r) => r.issues.length || r.errorOnScreen || r.horizontalScroll).length;
console.log(`\n${report.length - bad}/${report.length} telas sem problemas.`);
if (bad) process.exit(1);
