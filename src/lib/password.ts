/**
 * Regra de senha do app = regra do Supabase Auth (supabase/config.toml) = regra da Edge Function.
 * A fonte única fica em supabase/functions/_shared/password.ts (TypeScript puro, roda no
 * navegador e no Deno); aqui só reexportamos e montamos o schema dos formulários.
 */
import { z } from 'zod';
import { passwordProblems } from '../../supabase/functions/_shared/password.ts';

export {
  generatePassword,
  isValidPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordProblems,
} from '../../supabase/functions/_shared/password.ts';
export {
  EXPIRED_MESSAGE,
  isTemporaryExpired,
} from '../../supabase/functions/_shared/change-password.ts';

/** Texto curto para mostrar acima do campo. */
export const PASSWORD_HINT = 'Mínimo de 10 caracteres, com letras e números.';

/** Nova senha + confirmação (usado no primeiro acesso e em "Trocar senha"). */
export const newPasswordSchema = z
  .object({
    password: z.string().superRefine((value, ctx) => {
      for (const message of passwordProblems(value)) ctx.addIssue({ code: 'custom', message });
    }),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'As senhas não são iguais.',
  });

export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
