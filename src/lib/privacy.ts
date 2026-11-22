/** Versão da política de privacidade. Mudou o texto? Suba a versão: todos aceitam de novo. */
export const PRIVACY_VERSION = '2026-11';

/** Controlador dos dados (LGPD). O dono do ministério preenche (ver docs/pendencias.md). */
export const PRIVACY_CONTROLLER = '[NOME DO MINISTÉRIO / RESPONSÁVEL]';

export function needsPrivacyConsent(acceptedVersion: string | null | undefined): boolean {
  return acceptedVersion !== PRIVACY_VERSION;
}
