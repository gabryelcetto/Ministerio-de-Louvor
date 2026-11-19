import { Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Página provisória da fase A — será substituída pelo login/Dashboard na fase D. */
export function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <Card>
        <CardHeader>
          <div className="flex size-12 items-center justify-center rounded-full bg-primary text-accent">
            <Music aria-hidden="true" className="size-6" />
          </div>
          <h1 className="sr-only">Ministério de Louvor</h1>
          <CardTitle className="text-xl">Ministério de Louvor</CardTitle>
          <CardDescription>
            Escalas, repertório, cifras e agenda do ministério em um só lugar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button>Entrar</Button>
          <Button variant="secondary">Repertório</Button>
          <Button variant="accent">Escalas</Button>
        </CardContent>
      </Card>
    </main>
  );
}
