import { describe, expect, it } from 'vitest';
import { nextOffset, pageRange, PAGE_SIZE } from './paging';

describe('carregar mais', () => {
  it('intervalo inclusivo da página', () => {
    expect(pageRange(0)).toEqual([0, PAGE_SIZE - 1]);
    expect(pageRange(30, 10)).toEqual([30, 39]);
  });

  it('próxima página começa onde a anterior parou; página incompleta encerra', () => {
    const full = Array.from({ length: 3 }, (_, i) => i);
    expect(nextOffset(full, [full], 3)).toBe(3);
    expect(nextOffset(full, [full, full], 3)).toBe(6);
    expect(nextOffset([1], [full, [1]], 3)).toBeUndefined();
    expect(nextOffset([], [[]], 3)).toBeUndefined();
  });
});
