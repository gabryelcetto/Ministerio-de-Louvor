import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { signOut } from '../api';
import { EXPIRED_MESSAGE, isTemporaryExpired } from '@/lib/password';
import { PasswordForm } from './password-form';

/**
 * Primeiro acesso de quem foi cadastrado com senha provisória: o app inteiro fica bloqueado
 * até definir a própria senha. (No banco a conta também fica sem acesso até lá.)
 */
export function FirstAccessPage({
  name,
  expiresAt = null,
}: {
  name: string;
  /** Fim da validade da senha provisória (7 dias). Vencida: só um admin gera outra. */
  expiresAt?: string | null;
}) {
  const expired = isTemporaryExpired(expiresAt);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-4">
      <Card>
        <CardHeader className="items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary text-accent">
            <KeyRound aria-hidden="true" className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">
            {expired ? 'Senha provisória vencida' : 'Defina sua senha'}
          </h1>
          <CardDescription>
            {expired
              ? EXPIRED_MESSAGE
              : `${name ? `Bem-vindo(a), ${name}! ` : 'Bem-vindo(a)! '}Você entrou com uma senha provisória. Crie a sua para continuar.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Ao salvar, o perfil é recarregado e a guarda de rota libera o app. */}
          {!expired && <PasswordForm askCurrent={false} submitLabel="Salvar e entrar" />}
          <Button
            type="button"
            variant="ghost"
            onClick={() => void signOut()}
            className="self-center"
          >
            Sair
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
