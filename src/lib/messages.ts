/**
 * Mensagens que aparecem para a pessoa, num lugar só, em linguagem simples (sem termo técnico
 * nem nome de coluna). Erros do banco e da rede passam por friendlyError (src/lib/errors.ts),
 * que usa estas mensagens.
 */
export const MESSAGES = {
  noPermission: 'Você não tem permissão para isso. Fale com um administrador.',
  offline: 'Sem conexão. Tente de novo.',
  sessionExpired: 'Sua sessão expirou. Entre de novo.',
  generic: 'Não foi possível concluir. Tente de novo.',
  signOutFailed: 'Não foi possível sair. Tente de novo.',
} as const;
