import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { signOut } from '../api';
import { PasswordForm } from './password-form';

/**
 * Primeiro acesso de quem foi cadastrado com senha provisória: o app inteiro fica bloqueado
 * até definir a própria senha. (No banco a conta também fica sem acesso até lá.)
 */
export function FirstAccessPage({ name }: { name: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-4">
      <Card>
        <CardHeader className="items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary text-accent">
            <KeyRound aria-hidden="true" className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">Defina sua senha</h1>
          <CardDescription>
            {name ? `Bem-vindo(a), ${name}! ` : 'Bem-vindo(a)! '}
            Você entrou com uma senha provisória. Crie a sua para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Ao salvar, o perfil é recarregado e a guarda de rota libera o app. */}
          <PasswordForm askCurrent={false} submitLabel="Salvar e entrar" />
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
