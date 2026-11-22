import { describe, expect, it } from 'vitest';
import { linkify } from './linkify';

describe('links clicáveis no texto (sem HTML do banco)', () => {
  it('texto sem link fica como está', () => {
    expect(linkify('Ensaio às 19h.')).toEqual([{ kind: 'text', text: 'Ensaio às 19h.' }]);
    expect(linkify('')).toEqual([]);
  });

  it('separa o link e deixa a pontuação final de fora', () => {
    expect(linkify('Veja https://exemplo.com/a?b=1. Até!')).toEqual([
      { kind: 'text', text: 'Veja ' },
      { kind: 'link', text: 'https://exemplo.com/a?b=1', href: 'https://exemplo.com/a?b=1' },
      { kind: 'text', text: '. Até!' },
    ]);
  });

  it('www. ganha https:// no endereço', () => {
    expect(linkify('www.igreja.org')).toEqual([
      { kind: 'link', text: 'www.igreja.org', href: 'https://www.igreja.org' },
    ]);
  });

  it('vários links e parêntese do próprio endereço', () => {
    const parts = linkify('(http://a.com) e https://w.org/x_(y)');
    expect(parts.filter((p) => p.kind === 'link').map((p) => p.text)).toEqual([
      'http://a.com',
      'https://w.org/x_(y)',
    ]);
    expect(parts[0]).toEqual({ kind: 'text', text: '(' });
  });

  it('HTML no texto continua sendo texto (não vira link nem marcação)', () => {
    expect(linkify('<b>oi</b> javascript:alert(1)')).toEqual([
      { kind: 'text', text: '<b>oi</b> javascript:alert(1)' },
    ]);
  });
});
