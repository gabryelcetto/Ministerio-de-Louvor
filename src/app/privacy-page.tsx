import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ScreenHeader } from '@/components/layout/screen-header';
import { brand } from '@/config/brand';
import { PRIVACY_CONTROLLER, PRIVACY_VERSION } from '@/lib/privacy';

/** Política de privacidade (LGPD) em linguagem simples. Aberta para todos, até sem login. */
export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[45rem] p-4">
      <ScreenHeader title="Privacidade" subtitle={`Versão ${PRIVACY_VERSION}`} back="/" />
      <article className="flex flex-col gap-4 text-[0.9375rem] leading-relaxed">
        <Block title="Quem cuida dos seus dados">
          {PRIVACY_CONTROLLER}, que usa o app {brand.shortName} para organizar o ministério de
          louvor.
        </Block>
        <Block title="Que dados guardamos">
          Nome, apelido, telefone, as funções que você faz (voz, instrumento…), as escalas em que
          você está, as músicas e cifras que você edita e as gravações de áudio que você envia.
        </Block>
        <Block title="Para quê">
          Para montar as escalas, avisar você das mudanças, guardar o repertório e as gravações dos
          ensaios. Nada é vendido nem usado para propaganda.
        </Block>
        <Block title="Quem vê">
          Os integrantes ativos veem nomes, funções, escalas e o repertório. O telefone só aparece
          para quem a liderança autorizou. Os administradores veem o histórico de alterações.
        </Block>
        <Block title="Por quanto tempo">
          Gravações de ensaio: 90 dias. Cópias de segurança (backup): 30 dias. O resto fica enquanto
          você faz parte do ministério.
        </Block>
        <Block title="Correção ou exclusão">
          Você mesmo corrige nome, apelido e telefone em Mais → Configurações → Minha conta. Para
          corrigir outra coisa ou pedir a exclusão dos seus dados, fale com o administrador do
          ministério.
        </Block>
        <p>
          <Link to="/" className="font-semibold text-brand-text underline underline-offset-2">
            Voltar ao app
          </Link>
        </p>
      </article>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
      <h2 className="text-card-title">{title}</h2>
      <p>{children}</p>
    </section>
  );
}
