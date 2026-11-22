import { describe, expect, it } from 'vitest';
import { needsPrivacyConsent, PRIVACY_VERSION } from './privacy';

describe('aceite da política de privacidade', () => {
  it('pede o aceite quando nunca aceitou ou aceitou uma versão antiga', () => {
    expect(needsPrivacyConsent(null)).toBe(true);
    expect(needsPrivacyConsent('2000-01')).toBe(true);
    expect(needsPrivacyConsent(PRIVACY_VERSION)).toBe(false);
  });
});
