import { describe, expect, it } from 'vitest';
import * as nav from './nav';

describe('navegação do celular', () => {
  it('reconhece a rota ativa, inclusive subpáginas', () => {
    expect(nav.isPathActive('/', '/')).toBe(true);
    expect(nav.isPathActive('/agenda', '/')).toBe(false);
    expect(nav.isPathActive('/repertorio/123', '/repertorio')).toBe(true);
    expect(nav.isPathActive('/repertorio-antigo', '/repertorio')).toBe(false);
  });

  it('a barra tem no máximo 4 itens + "Mais"; o excedente vai para o menu', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((to) => ({ to, mobile: 'bar' as const }));
    const { bar, more } = nav.splitMobileNav([...items, { to: 'x', mobile: 'more' as const }]);
    expect(bar.map((i) => i.to)).toEqual(['a', 'b', 'c', 'd']);
    expect(more.map((i) => i.to)).toEqual(['e', 'x']);
  });
});
