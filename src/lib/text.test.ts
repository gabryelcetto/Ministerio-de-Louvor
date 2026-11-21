import { describe, expect, it } from 'vitest';
import { normalizeSearch } from './text';

describe('texto para busca', () => {
  it('tira acento, maiúsculas e espaços nas pontas', () => {
    expect(normalizeSearch('  Cântico da MANHÃ ')).toBe('cantico da manha');
    expect(normalizeSearch('')).toBe('');
  });
});
