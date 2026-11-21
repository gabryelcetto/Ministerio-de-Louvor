import { describe, expect, it } from 'vitest';
import { matchesSection, sectionsOf, SECTION_BADGE } from './sections';

const FUNCTIONS = [
  { id: 1, section: 'vocal' },
  { id: 2, section: 'vocal' },
  { id: 3, section: 'instrumental' },
];

describe('grupos do ministério', () => {
  it('selos sem repetir, cantores primeiro', () => {
    expect(
      sectionsOf([{ section: 'instrumental' }, { section: 'vocal' }, { section: 'vocal' }]),
    ).toEqual(['vocal', 'instrumental']);
    expect(sectionsOf([]).map((s) => SECTION_BADGE[s])).toEqual([]);
    expect(SECTION_BADGE.vocal).toBe('Cantor(a)');
  });

  it('filtro da montagem de escala', () => {
    expect(matchesSection([1], FUNCTIONS, 'vocal')).toBe(true);
    expect(matchesSection([1], FUNCTIONS, 'instrumental')).toBe(false);
    expect(matchesSection([1, 3], FUNCTIONS, 'instrumental')).toBe(true);
    expect(matchesSection([], FUNCTIONS, 'todos')).toBe(true);
    expect(matchesSection([], FUNCTIONS, 'vocal')).toBe(false);
  });
});
