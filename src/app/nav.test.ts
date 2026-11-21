import { describe, expect, it } from 'vitest';
import * as nav from './nav';

describe('navegação', () => {
  it('reconhece a rota ativa, inclusive subpáginas', () => {
    expect(nav.isPathActive('/', '/')).toBe(true);
    expect(nav.isPathActive('/agenda', '/')).toBe(false);
    expect(nav.isPathActive('/repertorio/123', '/repertorio')).toBe(true);
    expect(nav.isPathActive('/repertorio-antigo', '/repertorio')).toBe(false);
  });

  it('barra de baixo: 5 itens na ordem do design; lateral com 3 atalhos a mais', () => {
    expect(nav.PRIMARY_PATHS).toEqual(['/', '/escalas', '/repertorio', '/agenda', '/mais']);
    expect(nav.DESKTOP_EXTRA_PATHS).toEqual(['/integrantes', '/comunicados', '/configuracoes']);
  });

  it.each([
    ['/', '/'],
    ['/escalas/abc', '/escalas'],
    ['/escalas/montar', '/escalas'],
    ['/repertorio/nova', '/repertorio'],
    ['/agenda', '/agenda'],
    ['/mais', '/mais'],
    ['/integrantes/funcoes', '/mais'],
    ['/configuracoes', '/mais'],
    ['/comunicados', '/mais'],
    ['/instalar', '/mais'],
    ['/atividade', '/mais'],
    ['/notificacoes', null],
    ['/nada', null],
  ])('%s marca %s', (path, item) => {
    expect(nav.activePrimary(path)).toBe(item);
  });

  it('telas principais têm o topo do app; as outras, voltar + título', () => {
    for (const path of ['/', '/escalas', '/repertorio', '/agenda', '/mais', '/repertorio/']) {
      expect(nav.isMainScreen(path), path).toBe(true);
    }
    for (const path of ['/repertorio/123', '/notificacoes', '/configuracoes', '/escalas/x']) {
      expect(nav.isMainScreen(path), path).toBe(false);
    }
    expect(nav.isMainScreen('')).toBe(true);
  });
});
