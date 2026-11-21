/** API pública da feature auth (outras features importam só daqui). */
export { signOut } from './api';
export { PasswordForm } from './components/password-form';
export { useMyPermissions, useMyProfile } from './hooks/use-me';
export { usePermission } from './permissions';
export { useSession } from './session-context';
