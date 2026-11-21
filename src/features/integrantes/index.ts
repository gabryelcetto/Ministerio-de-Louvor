/** API pública da feature integrantes (outras features importam só daqui). */
export {
  buildMembers,
  matchesName,
  ROLE_LABEL,
  useMembers,
  useMyFunctions,
  type Member,
  type MyFunction,
} from './api';
export { useManagedFunctions, type MinistryFunction } from './functions';
export * from './sections';
