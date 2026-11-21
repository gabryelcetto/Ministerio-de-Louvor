# Relatório de QA — 21/11/2026

QA automatizado (`e2e/qa.mjs`, passo "QA" do workflow **E2E (dados reais)**) com o Supabase
local e os usuários demo:

- **Navegadores:** Chromium, WebKit (motor do Safari/iPhone) e Firefox.
- **Tamanhos:** 375x667, 390x844, 768x1024 e 1440x900.
- **Perfis:** admin (Ana) e integrante (Isa).
- **Tema escuro:** em todas as telas, no Chromium, em 390x844 e 1440x900.
- **Telas:** 17 para a integrante e 21 para o admin, incluindo "Música com textos longos" (título,
  observação e cifra enormes, criada pelo próprio roteiro), evento e página inexistentes.
- **Em cada tela:** axe-core (falha em violações sérias ou críticas), erros de console e de
  página, respostas 4xx/5xx inesperadas da API e elementos saindo da largura da tela.
- **Casos de borda:** textos longos, listas vazias, internet lenta e offline ao salvar e ao enviar
  áudio, duplo clique em salvar, Voltar do navegador no meio do formulário, sessão expirada,
  microfone negado, arquivo acima de 45 MB e troca rápida de tom (24 cliques seguidos).

| Rodada                                  | Execução                                                                                     | Telas verificadas | Crítico | Alto  | Médio | Baixo |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------- | ------- | ----- | ----- | ----- |
| 1 (antes das correções)                 | [44909578219](https://github.com/gabryelcetto/Ministerio-de-Louvor/actions/runs/44909578219) | 560               | 8       | 134   | 3     | 0     |
| 2 (correções 2 a 4 + espera após login) | [44911225894](https://github.com/gabryelcetto/Ministerio-de-Louvor/actions/runs/44911225894) | 560               | 2       | 1     | 3     | 0     |
| 3 (roteiro ajustado)                    | [44913369666](https://github.com/gabryelcetto/Ministerio-de-Louvor/actions/runs/44913369666) | 560               | **0**   | **0** | 3     | 0     |

As 142 ocorrências críticas e altas da rodada 1 vêm de **5 problemas** repetidos em vários
navegadores e tamanhos. Um deles era do próprio roteiro (falso positivo). Na rodada 3 não
sobrou nenhum crítico ou alto. Os 3 médios restantes estão nas pendências 44 a 46, e um médio
achado nos testes de tela está na 47.

Gravidades: **crítico** = app quebra ou perde dados sem aviso; **alto** = bloqueia uma tarefa,
fere acessibilidade (axe sério/crítico) ou faz a página rolar para o lado; **médio** =
incômodo com saída; **baixo** = cosmético.

## Problemas

### 1. Voltar do navegador na "Nova música" perde tudo sem aviso — alto · corrigido

- **Tela:** Repertório → Nova música (`/repertorio/nova`).
- **Passos:** abrir Nova música, digitar o título (ou colar a cifra), tocar em Voltar do
  navegador (ou fazer o gesto de voltar no iPhone).
- **Esperado:** confirmação "Sair sem salvar?" antes de perder o que foi digitado.
- **Obtido:** saiu para `/repertorio` sem perguntar; a cifra colada se perdeu.
- **Navegador e tamanho:** Chromium 390x844 (o comportamento é do app, vale para todos).
- **Print:** [voltar-no-meio-do-formulario.png](prints/voltar-no-meio-do-formulario.png)
- **Correção:** commit "fix(repertório): Nova música pede confirmação…". Usa o mesmo guarda
  dos editores de letra e cifra; depois de salvar, a ida para a música nova não é bloqueada.
- **Conferência:** na rodada 2 o roteiro ainda abria a tela com `page.goto` (um documento
  novo, e aí o Voltar sai do app). Na rodada 3 a tela é aberta pelo link "Nova música", como
  a pessoa faz: a confirmação aparece e o texto fica.

### 2. Botões "A−/A+" e "10s" com nome acessível diferente do texto — alto · corrigido

- **Telas:** Música, Música (aba letra), Música com textos longos e Ensaio (player das
  gravações).
- **Passos:** abrir a tela; o axe aponta `label-content-name-mismatch` (sério).
- **Esperado:** o nome lido pelo leitor de tela, ou usado no comando de voz, contém o texto
  visível (WCAG 2.5.3).
- **Obtido:** botões com "A−" e "A+" visíveis se chamavam "Diminuir letra" e "Aumentar letra";
  os botões com "10s" se chamavam "Voltar 10 segundos" e "Avançar 10 segundos".
- **Navegador e tamanho:** os 3 navegadores, os 4 tamanhos, os 2 temas, os 2 perfis
  (112 ocorrências).
- **Prints:** [musica-axe-nome-botoes-a.png](prints/musica-axe-nome-botoes-a.png),
  [ensaio-axe-nome-botoes-10s.png](prints/ensaio-axe-nome-botoes-10s.png)
- **Correção:** commit "fix(acessibilidade): nome dos botões…". O texto visível fica fora da
  leitura e o nome vem de um texto só para leitor de tela.

### 3. Palavra muito longa na cifra faz a página rolar para o lado — alto · corrigido

- **Tela:** Música com textos longos.
- **Passos:** abrir uma música cuja cifra tem uma palavra maior que a tela (ex.: "Aleluiaaaa…"
  esticado, ou um link colado).
- **Esperado:** a palavra quebra dentro da largura; nada passa da tela.
- **Obtido:** rolagem lateral (o bloco ia até 549 px numa tela de 375 px). Título, observação e
  nome do autor longos quebravam certo; o problema era só na cifra.
- **Navegador e tamanho:** os 3 navegadores em 375x667, 390x844 e 768x1024 (20 ocorrências).
- **Print:** [musica-textos-longos-rolagem-lateral.png](prints/musica-textos-longos-rolagem-lateral.png)
- **Correção:** commit "fix(cifra): palavra muito longa…". O texto de cada bloco quebra onde
  for preciso (`overflow-wrap: anywhere`) sem desalinhar os acordes.

### 4. App quebrava na abertura em navegador sem AudioWorklet — alto · corrigido

- **Tela:** todas (o erro acontecia ao carregar o app).
- **Passos:** abrir o app num navegador sem `AudioWorkletNode` (Safari antigo, WebView antiga).
- **Esperado:** o app abre; só a mudança de tom do áudio fica indisponível.
- **Obtido:** `ReferenceError: AudioWorkletNode is not defined` no carregamento. A biblioteca
  do SoundTouch faz `class … extends AudioWorkletNode` assim que é importada.
- **Como foi achado:** montando o app inteiro nos testes de tela (ambiente sem Web Audio). Os
  navegadores do Playwright têm AudioWorklet, então a varredura não pegaria.
- **Correção:** commit "fix(áudio): SoundTouch só carrega ao tocar…". A biblioteca é
  carregada com `import()` na primeira vez que alguém toca um áudio.

### 5. "Fetch API cannot load … due to access control checks" no WebKit — falso positivo

- **Tela:** Início, logo depois do login, e os casos de borda que começam pelo login.
- **Obtido:** erro de página no WebKit, nos 4 tamanhos e nos 2 perfis (8 ocorrências
  "críticas" e 1 "alta"), sempre na consulta do perfil.
- **Análise:** só acontecia quando o roteiro recarregava a página com a consulta do perfil
  ainda em andamento. O WebKit registra o cancelamento com essa mensagem; nenhuma outra tela,
  nem o Chromium e o Firefox, teve o erro.
- **Ajuste:** na rodada 2 o roteiro passou a esperar o Início carregar depois do login, e o
  erro caiu de 9 para 2 ocorrências, ainda só em trocas de página feitas pelo roteiro. Na
  rodada 3, esse erro específico do WebKit é ignorado **só enquanto o roteiro está trocando de
  página** (descarte das consultas do documento anterior). Erros de página em qualquer outro
  momento continuam reprovando.
- **Print:** [webkit-inicio-fetch-cancelado.png](prints/webkit-inicio-fetch-cancelado.png)

### 6. Duplo clique em "Salvar letra" grava duas vezes — médio · pendência 44

- **Passos:** Música → Editar letra → alterar → duplo clique em "Salvar letra".
- **Esperado:** uma gravação.
- **Obtido:** 2 gravações no Chromium (1 no WebKit e no Firefox). O texto final é o mesmo,
  mas o histórico ganha uma versão repetida.
- **Navegador e tamanho:** Chromium 390x844.
- **Print:** [duplo-clique-salvar-letra.png](prints/duplo-clique-salvar-letra.png)

### 7. Sem internet ao salvar: a mensagem de conexão não aparece logo — médio · pendência 45

- **Passos:** Editar letra → ficar offline → Salvar letra.
- **Esperado:** "Sem conexão com o servidor…" e o texto continua no campo.
- **Obtido:** o texto continua no campo (nada se perde), mas o botão fica em "Salvando…" e a
  mensagem não apareceu em 15 s (rodadas 1 a 3).
- **Navegador e tamanho:** Chromium 390x844.
- **Print:** [offline-salvar-letra.png](prints/offline-salvar-letra.png)

### 8. Envio de áudio sem internet fica em "Enviando… 0%" — médio · pendência 46

- **Passos:** Ensaio → Gravar ensaio → Parar → ficar offline → Enviar.
- **Esperado:** erro "Sem conexão…" com "Tentar de novo"; a gravação continua no aparelho.
- **Obtido:** mais de 20 s em "Enviando… 0%", com "Enviar" e "Descartar" desativados. A
  gravação continua salva no aparelho.
- **Navegador e tamanho:** Chromium 390x844.
- **Print:** [offline-enviar-audio.png](prints/offline-enviar-audio.png)

### 9. Mensagens específicas do envio de áudio não chegam à tela — médio · pendência 47

- **Como foi achado:** teste de tela "falha de rede no envio" (Vitest).
- **Obtido:** a tela mostra "Não foi possível enviar o áudio." em vez de "Sem conexão…" ou
  "O arquivo passou do limite de 45 MB". `UploadError` não é `UserFacingError`.

## Casos de borda sem problema

- **Internet lenta (2,5 s) ao salvar:** "Salvando…" com o botão travado; salvou no fim.
- **Sessão expirada** (token e refresh inválidos): volta para o login.
- **Microfone negado:** "Sem acesso ao microfone. Libere o microfone para este site…".
- **Arquivo acima de 45 MB:** recusado na hora, sem enviar, nos 3 navegadores.
- **Troca rápida de tom** (24 cliques): sem erros no Chromium e no Firefox (o WebKit acusou só
  o falso positivo do item 5).
- **Listas vazias:** "Nenhuma música…" no Repertório e "Ninguém encontrado com esse nome." em
  Integrantes.
- **Tema escuro:** nenhuma violação de contraste séria ou crítica em nenhuma tela.
