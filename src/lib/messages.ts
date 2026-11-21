/**
 * Mensagens que aparecem para a pessoa, num lugar só, em linguagem simples (sem termo técnico
 * nem nome de coluna). Erros do banco e da rede passam por friendlyError (src/lib/errors.ts),
 * que usa estas mensagens; o envio de áudio (src/lib/audio/upload.ts) também.
 */
export const MESSAGES = {
  noPermission: 'Você não tem permissão para isso. Fale com um administrador.',
  offline: 'Sem conexão. Tente de novo.',
  sessionExpired: 'Sua sessão expirou. Entre de novo.',
  generic: 'Não foi possível concluir. Tente de novo.',
  nothingSaved: 'Nada foi salvo: você não tem permissão para isso ou o item não existe mais.',
  signOutFailed: 'Não foi possível sair. Tente de novo.',
  uploadFailed: 'Não foi possível enviar o áudio. Tente de novo.',
  uploadCanceled: 'Envio cancelado.',
  uploadTooLarge: 'O arquivo passou do limite de 45 MB.',
  uploadWrongType: 'Tipo de arquivo não aceito: envie um arquivo de áudio.',
  uploadDuplicate: 'Já existe um arquivo com este nome. Tente de novo.',
} as const;

/** Textos de estado e de rótulo em linguagem simples (sem "pending", "official", "versão"). */
export const LABELS = {
  pending: 'Aguardando revisão',
  official: 'Oficial',
  officialKey: 'Tom oficial',
  change: 'alteração',
  changes: 'alterações',
} as const;
