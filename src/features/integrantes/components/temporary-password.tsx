import { Copy, MessageCircle, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { whatsappLink } from '../invite';

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2500);
    } catch {
      setCopied(null);
    }
  };
  return { copied, copy };
}

/**
 * Senha provisória mostrada UMA vez (cadastro e redefinição): aviso, e-mail, senha, botões de
 * copiar, link do WhatsApp e a mensagem pronta.
 */
export function TemporaryPasswordPanel({
  email,
  temporaryPassword,
  message,
}: {
  email: string;
  temporaryPassword: string;
  message: string;
}) {
  const { copied, copy } = useCopy();
  const messageId = useId();

  return (
    <div className="flex flex-col gap-4">
      <p
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-accent bg-accent/15 p-3 text-sm"
      >
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {/* Um único span: dentro do flex, texto e <strong> soltos viravam colunas separadas. */}
        <span>
          Anote ou envie agora: esta senha provisória <strong>não será mostrada de novo</strong>.
        </span>
      </p>

      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[9rem_1fr]">
        <dt className="text-muted-foreground">E-mail</dt>
        <dd className="font-medium break-all">{email}</dd>
        <dt className="text-muted-foreground">Senha provisória</dt>
        <dd>
          <code
            aria-label="Senha provisória"
            className="rounded-md bg-muted px-2 py-1 font-mono text-lg font-semibold tracking-wide select-all"
          >
            {temporaryPassword}
          </code>
        </dd>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void copy('senha', temporaryPassword)}
        >
          <Copy aria-hidden="true" />
          Copiar senha
        </Button>
        <Button type="button" variant="outline" onClick={() => void copy('mensagem', message)}>
          <Copy aria-hidden="true" />
          Copiar mensagem
        </Button>
        <Button type="button" variant="accent" asChild>
          <a href={whatsappLink(message)} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" />
            Enviar pelo WhatsApp
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        </Button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm font-medium">
        {copied === 'senha' && 'Senha copiada.'}
        {copied === 'mensagem' && 'Mensagem copiada.'}
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={messageId}>Mensagem pronta para o WhatsApp</Label>
        <Textarea
          id={messageId}
          readOnly
          value={message}
          rows={8}
          className="font-sans text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
    </div>
  );
}
