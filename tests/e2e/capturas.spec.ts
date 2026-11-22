/**
 * Capturas do novo visual (390×844, claro e escuro) com os dados do seed.
 * Saem em capturas-design/ e viram o artefato "capturas-design" do workflow E2E.
 * Roda ANTES dos roteiros que criam dados (fluxos.mjs), para mostrar só o seed.
 */
import { expect, test, type Page } from '@playwright/test';

const PASSWORD = process.env.DEMO_PASSWORD ?? '';
const SONG = '00000000-0000-4000-8000-000000000001';
const REHEARSAL = '10000000-0000-4000-8000-000000000001';
const OUT = 'capturas-design';
const THEMES = { claro: 'light', escuro: 'dark' } as const;

/** Guarda o tema antes de o app abrir (null = primeiro acesso, sem tema escolhido). */
async function setTheme(page: Page, theme: 'light' | 'dark' | null) {
  await page.addInitScript((t) => {
    try {
      if (t) localStorage.setItem('louvor.theme', t);
      else localStorage.removeItem('louvor.theme');
    } catch {
      // armazenamento indisponível
    }
  }, theme);
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('integrante@demo.local');
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
  await page.waitForLoadState('networkidle');
}

async function shoot(page: Page, file: string) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${file}.png` });
}

for (const [tema, theme] of Object.entries(THEMES)) {
  test(`telas principais — tema ${tema}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await setTheme(page, theme);
    await login(page);

    await page.goto('/');
    await expect(page.getByText('Sua próxima escala')).toBeVisible();
    await shoot(page, `${tema}-1-inicio`);

    await page.goto('/repertorio');
    await expect(page.getByRole('list', { name: 'Músicas' })).toBeVisible();
    await shoot(page, `${tema}-2-repertorio`);

    await page.goto(`/repertorio/${SONG}`);
    await expect(page.getByRole('region', { name: 'Controles da música' })).toBeVisible();
    await shoot(page, `${tema}-3-musica`);

    await page.goto(`/escalas/${REHEARSAL}`);
    await expect(page.getByRole('button', { name: 'Gravar ensaio' })).toBeVisible();
    await shoot(page, `${tema}-4-escala-de-ensaio`);

    await page.goto('/repertorio/nova');
    await expect(page.getByLabel('Título')).toBeVisible();
    await shoot(page, `${tema}-5-nova-musica`);

    await page.goto('/comunicados');
    await expect(page.getByRole('list', { name: 'Comunicados' })).toBeVisible();
    await shoot(page, `${tema}-8-comunicados`);

    await page.goto('/agenda');
    await expect(page.getByRole('navigation', { name: 'Mês' })).toBeVisible();
    await shoot(page, `${tema}-9-agenda`);

    await page.goto('/escalas');
    await expect(page.getByRole('heading', { name: 'Escalas' })).toBeVisible();
    await shoot(page, `${tema}-10-escalas`);

    await page.goto('/mais');
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
    await shoot(page, `${tema}-7-mais`);
  });

  test(`modal de tema no primeiro acesso — tema ${tema}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await setTheme(page, null);
    await login(page);
    await expect(page.getByRole('dialog', { name: 'Como você prefere ver o app?' })).toBeVisible();
    await shoot(page, `${tema}-6-modal-de-tema`);
  });
}
