import { describe, expect, it } from 'vitest';
import { describeMyRole } from './my-role';

const f = (name: string, section: 'vocal' | 'instrumental' | null) => ({ name, section });

describe('frase da função no card "Sua próxima escala"', () => {
  it.each([
    [[f('Bateria', 'instrumental')], 'Você toca bateria'],
    [[f('Backing vocal', 'vocal')], 'Você canta (backing vocal)'],
    [[f('Vocal', 'vocal'), f('Violão', 'instrumental')], 'Você canta (vocal) e toca violão'],
    [
      [f('Violão', 'instrumental'), f('Teclado', 'instrumental'), f('Baixo', 'instrumental')],
      'Você toca violão, teclado e baixo',
    ],
    [
      [f('Ministro(a)', 'vocal'), f('Backing vocal', 'vocal')],
      'Você canta (ministro(a) e backing vocal)',
    ],
    [[f('Som', 'instrumental')], 'Você fica em som'],
    [
      [f('Mesa de som', 'instrumental'), f('Projeção', 'instrumental')],
      'Você fica em mesa de som e projeção',
    ],
    [[f('Dança', null)], 'Você fica em dança'],
    [[], 'Você está na escala'],
  ])('%j → %s', (functions, text) => {
    expect(describeMyRole(functions)).toBe(text);
  });
});
