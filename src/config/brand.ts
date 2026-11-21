/**
 * Identidade do app. Para usar em outra igreja, troque só aqui: o nome aparece no topo, no
 * login, no título da aba, no manifest do PWA (ícone instalado) e na mensagem de convite.
 * Este arquivo também é lido pelo vite.config.ts, por isso não importa nada do app.
 */
export const brand = {
  /** Nome curto da igreja (aparece no topo do celular, acima da saudação). */
  churchName: 'ADVOP',
  /** Nome do app. */
  appName: 'Ministério de Louvor',
  /** Nome do app instalado e do topo das telas (manifest name). */
  shortName: 'Louvor ADVOP',
  /** Nome embaixo do ícone na tela inicial (manifest short_name: bem curto). */
  iconLabel: 'Louvor',
  /** Descrição do PWA. */
  description: 'Escalas, repertório, cifras e agenda do Ministério de Louvor da ADVOP.',
} as const;

/** "Ministério de Louvor · ADVOP" — título da aba, login e topo. */
export const brandTitle = `${brand.appName} · ${brand.churchName}`;
