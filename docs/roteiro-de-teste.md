# Roteiro de teste das telas de leitura (fase E)

> **Automatizado:** a maior parte deste roteiro roda sozinha em todo PR no workflow
> **E2E (dados reais)** (`e2e/varredura.mjs`, `e2e/fluxos.mjs` e `e2e/api-checks.mjs`; ver
> README). Este documento continua valendo para a conferência manual e para o que não é
> automatizado (rede lenta/offline, Safari do iPhone, instalação do app).

Para rodar com dados reais: `npx supabase db start`, criar no painel os 3 usuários de
`supabase/demo-users.sql` (admin, líder e integrante), rodar o script e abrir o app com
`npm run dev`. Faça cada roteiro **no celular (ou com a janela estreita) e no computador**.

- **Integrante:** `integrante@demo.local` (Isa — Bateria, sem permissões extras).
- **Admin:** `admin@demo.local` (Ana — dono, todas as permissões).

Marque ✅/❌ e anote o que estranhar.

---

## Início (`/`)

| #   | Passo                                      | Integrante                                                | Admin                                      |
| --- | ------------------------------------------ | --------------------------------------------------------- | ------------------------------------------ |
| 1   | Abrir o app logado                         | "Bom dia/Boa tarde/Boa noite, Isa!" conforme a hora de SP | Idem com "Ana"                             |
| 2   | Cartões "Próximo culto" e "Próximo ensaio" | Culto de celebração e Ensaio geral do seed                | Idem                                       |
| 3   | Linha "Você está escalado(a)"              | Bateria nos dois                                          | Teclado no culto; "não escalado" no ensaio |
| 4   | Repertório do próximo culto                | 4 músicas na ordem, com o tom do dia                      | Idem                                       |
| 5   | Tocar numa música do repertório            | Abre a música **já no tom do dia** (`?tom=`)              | Idem                                       |
| 6   | Contador de notificações                   | Igual ao número no sino/menu                              | Idem                                       |
| 7   | Comunicados recentes                       | Até 3, do mais recente                                    | Idem                                       |

## Minhas escalas (`/escalas`) e detalhe (`/escalas/:id`)

| #   | Passo                             | Integrante                                                                        | Admin                              |
| --- | --------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | Abrir Escalas                     | 3 eventos (ensaio, culto, culto da família), mais próximo primeiro, com "Bateria" | 2 eventos (Teclado, Backing vocal) |
| 2   | Abrir um evento                   | Equipe agrupada por função; "você" destacado                                      | Idem                               |
| 3   | Repertório do evento              | Ordem 1, 2, 3…; selo "tom do dia/oficial/original"                                | Idem                               |
| 4   | Abrir `/escalas/<id-inexistente>` | "Evento não encontrado"                                                           | Idem                               |

## Agenda (`/agenda`)

| #   | Passo                          | Integrante                                                                              | Admin               |
| --- | ------------------------------ | --------------------------------------------------------------------------------------- | ------------------- |
| 1   | Abrir Agenda                   | 5 eventos agrupados por dia; culto azul, ensaio roxo, evento dourado, cada um com ícone | Idem                |
| 2   | Filtros Cultos/Ensaios/Eventos | Lista filtra; "Todos" volta                                                             | Idem                |
| 3   | Selo "Você está escalado(a)"   | Nos eventos com Isa                                                                     | Nos eventos com Ana |

## Repertório (`/repertorio`)

| #   | Passo                              | Integrante                                               | Admin |
| --- | ---------------------------------- | -------------------------------------------------------- | ----- |
| 1   | Abrir Repertório                   | 12 músicas em ordem alfabética, com tom oficial/original | Idem  |
| 2   | Buscar sem acento (ex.: `cantico`) | Encontra "Cântico…"                                      | Idem  |
| 3   | Buscar pelo autor                  | Encontra as músicas do autor                             | Idem  |
| 4   | Tocar numa categoria               | Só músicas dela; "Todas" volta                           | Idem  |
| 5   | Buscar algo que não existe         | "Nenhuma música encontrada com esses filtros."           | Idem  |
| 6   | Abrir uma música e voltar          | A busca e o filtro continuam como estavam                | Idem  |

## Música (`/repertorio/:id`)

| #   | Passo                                             | Integrante                                                               | Admin |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------ | ----- |
| 1   | Abrir uma música com cifra                        | Abre na aba **Cifra**, no **tom oficial**; acordes em negrito dourado    | Idem  |
| 2   | Botões − e +                                      | Sobe/desce meio tom; seletor mostra o tom novo; acordes mudam            | Idem  |
| 3   | Escolher um tom no seletor                        | Cifra inteira vai para o tom                                             | Idem  |
| 4   | "Tom oficial"                                     | Volta ao tom oficial; botão fica desativado                              | Idem  |
| 5   | Música sem tom oficial                            | "Tom oficial" desativado; abre no tom da cifra                           | Idem  |
| 6   | A− / A+                                           | Letra e acordes mudam juntos; o tamanho fica salvo ao reabrir            | Idem  |
| 7   | Aba **Letra**                                     | Letra grande, sem acordes; barra de tom some                             | Idem  |
| 8   | Cifra `pending` (música `…-000000000005` do seed) | Aviso "aguardando revisão"                                               | Idem  |
| 9   | Link de mídia (se houver)                         | Abre em nova aba                                                         | Idem  |
| 10  | No celular, tocando                               | Barra de tom fixa acima da navegação, botões ≥ 48px, sem rolagem lateral | Idem  |
| 11  | Recarregar a página com outro tom                 | Continua no tom escolhido (`?tom=`)                                      | Idem  |

## Notificações (`/notificacoes`, sino no topo do celular)

| #   | Passo                     | Integrante                                                                | Admin |
| --- | ------------------------- | ------------------------------------------------------------------------- | ----- |
| 1   | Abrir                     | Notificações das escalas do `demo-users.sql`; não lidas com fundo dourado | Idem  |
| 2   | ✓ numa não lida           | Fica lida; contadores do sino, do menu e do Início diminuem               | Idem  |
| 3   | Tocar numa notificação    | Abre o evento e marca como lida                                           | Idem  |
| 4   | "Marcar todas como lidas" | Todas lidas; botão desativa; contador zera                                | Idem  |
| 5   | Filtro "Não lidas"        | Só as não lidas; vazio mostra "Tudo em dia…"                              | Idem  |
| 6   | Outro usuário             | Nunca aparecem notificações de outra pessoa (RLS)                         | Idem  |

## Comunicados (`/comunicados`, menu "Mais" no celular)

| #   | Passo                                                         | Integrante                                   | Admin                         |
| --- | ------------------------------------------------------------- | -------------------------------------------- | ----------------------------- |
| 1   | Abrir                                                         | 3 comunicados do seed, mais recente primeiro | Idem                          |
| 2   | Comunicado com `published_at` no futuro (criar no SQL Editor) | **Não aparece**                              | Aparece com o selo "Agendado" |

## Integrantes (`/integrantes`, menu "Mais" no celular)

| #   | Passo                        | Integrante                                    | Admin                               |
| --- | ---------------------------- | --------------------------------------------- | ----------------------------------- |
| 1   | Abrir                        | Ana, Isa, Lucas com funções; **sem telefone** | Idem **com telefone** (link `tel:`) |
| 2   | DevTools → Rede              | **Nenhuma** chamada a `get_member_contacts`   | Chamada a `get_member_contacts`     |
| 3   | Inativar alguém (SQL Editor) | Some da lista                                 | Aparece em "Inativos"               |
| 4   | Buscar "ISA" / "isa"         | Encontra Isa                                  | Idem                                |

## Menu "Mais" (celular)

| #   | Passo                | Integrante                                                                                                          | Admin |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | Tocar em "Mais"      | Abre painel com Notificações, Comunicados, Integrantes e Configurações (tela pessoal: perfil, tema, instalar, sair) | Idem  |
| 2   | Esc / tocar fora / ✕ | Fecha e o foco volta ao botão "Mais"                                                                                | Idem  |
| 3   | Estar em Comunicados | "Mais" aparece como ativo na barra                                                                                  | Idem  |

## Estados comuns (todas as telas)

- **Carregando:** com a rede em "Slow 3G" (DevTools), aparece "Carregando…".
- **Erro:** com a rede "Offline", aparece a mensagem e o botão **"Tentar de novo"**; voltar a rede
  e tocar no botão carrega a tela.
- **Vazio:** com o banco sem dados (antes do `demo-users.sql`), cada lista mostra a sua mensagem.

---

# Fase F — edição, histórico e escalas

Use também o **líder** (`lider@demo.local`, Lucas): tem `chords.edit_official`,
`songs.set_official_key`, `history.restore`, `schedules.manage` e `events.manage`, mas não
`members.manage`.

## Música — editar (`/repertorio/:id`)

| #   | Passo                                                                                           | Integrante (Isa)                                                                                         | Admin (Ana)                                                                             |
| --- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Botões abaixo do título                                                                         | Só **Editar letra** e **Histórico**                                                                      | Editar letra, **Editar cifra**, **Definir tom oficial**, Histórico                      |
| 2   | Editar letra → mudar → **Salvar letra**                                                         | "Letra salva."; a aba Letra mostra o texto novo sem recarregar                                           | Idem                                                                                    |
| 3   | Editar letra → mudar → **Cancelar**                                                             | Pergunta "Descartar alterações?"                                                                         | Idem                                                                                    |
| 4   | Editar letra → mudar → clicar em "Agenda" no menu                                               | Pergunta "Sair sem salvar?"; "Continuar editando" mantém o texto                                         | Idem                                                                                    |
| 5   | **Integrante tenta editar cifra**: no console do navegador, `upsert` em `song_chords` da música | Banco recusa (42501). Se a tela for forçada, aparece "Você não tem permissão para fazer essa alteração." | —                                                                                       |
| 6   | Editar cifra → digitar `[Xyz]`                                                                  | —                                                                                                        | Aviso "Não reconhecido como acorde…"; pré-visualização atualiza ao digitar              |
| 7   | Editar cifra → **Salvar cifra**                                                                 | —                                                                                                        | "Cifra salva."; a cifra exibida muda; aviso de "aguardando revisão" some (vira oficial) |
| 8   | Cifra `pending` (`…-000000000005`) → Editar → Salvar                                            | —                                                                                                        | Passa a oficial                                                                         |
| 9   | "Converter acordes sobre a letra" com texto de site                                             | —                                                                                                        | Vira ChordPro com os acordes no lugar                                                   |
| 10  | **Definir tom oficial** → escolher → Salvar                                                     | —                                                                                                        | "Tom oficial salvo."; lista do repertório, Início e detalhe do culto mostram o tom novo |
| 11  | Tom oficial → "Sem tom oficial" → Salvar                                                        | —                                                                                                        | Botão "Tom oficial" da barra fica desativado                                            |

## Histórico (`/repertorio/:id/historico`)

| #   | Passo                                                                         | Integrante (Isa)                                                    | Admin (Ana)                                                                                                                 |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | Abrir depois dos passos acima                                                 | Vê as versões: campo, quem, quando, resumo; **sem botão Restaurar** | Idem, com **Restaurar** nas versões que não são a atual                                                                     |
| 2   | Abrir "Valor anterior" / "Conteúdo desta versão"                              | Mostra os textos                                                    | Idem                                                                                                                        |
| 3   | Filtros Cifra / Letra / Tom oficial                                           | Lista filtra                                                        | Idem                                                                                                                        |
| 4   | **Admin restaura** uma cifra antiga                                           | —                                                                   | Confirmação → "Versão restaurada…"; nova linha "Restauração" no topo marcada "versão atual"; a música mostra a cifra antiga |
| 5   | Restaurar o tom oficial antigo                                                | —                                                                   | Tom oficial volta; repertório e Início atualizam                                                                            |
| 6   | **Integrante tenta restaurar** pelo console: `rpc('restore_song_version', …)` | Banco recusa: "Sem permissão para restaurar versões."               | —                                                                                                                           |

## Montar escala (`/escalas/montar`)

| #   | Passo                                                  | Integrante (Isa)                              | Líder / Admin                                                                                      |
| --- | ------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Abrir Escalas                                          | **Sem** botão "Montar escala"                 | Botão "Montar escala"                                                                              |
| 2   | Abrir `/escalas/montar` pelo endereço                  | "Você não tem permissão para montar escalas." | Formulário                                                                                         |
| 3   | Salvar sem preencher                                   | —                                             | "Informe o título." / "Informe data e hora de início."                                             |
| 4   | Novo evento + 2 pessoas → Salvar                       | —                                             | Abre o detalhe do evento novo com a equipe; Agenda mostra o evento; cada pessoa recebe notificação |
| 5   | Mesma pessoa e função duas vezes                       | —                                             | "Essa pessoa já está nessa função." antes de enviar                                                |
| 6   | Detalhe do evento → **Editar escala** → Remover alguém | —                                             | Confirmação → sai da lista; a pessoa recebe "Você saiu da escala"                                  |
| 7   | Horário: criar evento às 19:30                         | —                                             | Aparece 19:30 na Agenda mesmo com o aparelho em outro fuso                                         |

## Mensagens de erro (todas as telas de edição)

- Rede "Offline" ao salvar → "Sem conexão com o servidor. Verifique a internet e tente de novo."
- Sessão expirada → "Sua sessão expirou. Entre de novo."
- Nenhuma mensagem em inglês ou com código técnico deve aparecer.

---

# Cadastro de integrantes e primeiro acesso

Automatizado em `e2e/fluxos.mjs` (seção CADASTRO) e `e2e/api-checks.mjs` (Edge Function).

## Cadastrar integrante (`/integrantes/cadastrar`)

| #   | Passo                                                             | Integrante (Isa)                                         | Admin (Ana)                                                                                      |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | Abrir Integrantes                                                 | **Sem** botão "Cadastrar integrante"                     | Botão "Cadastrar integrante"                                                                     |
| 2   | Abrir `/integrantes/cadastrar` pelo endereço                      | "Você não tem permissão para cadastrar integrantes."     | Formulário                                                                                       |
| 3   | Cadastrar sem preencher                                           | —                                                        | "Informe o nome completo." / "Informe o e-mail."                                                 |
| 4   | Perfil de acesso                                                  | —                                                        | Integrante, Liderança e Administração (quem só tem `members.manage` vê os dois últimos travados) |
| 5   | Nome, e-mail novo, funções → **Cadastrar**                        | —                                                        | Senha provisória (4 grupos de 4), aviso "não será mostrada de novo", mensagem pronta             |
| 6   | **Copiar senha** / **Copiar mensagem** / **Enviar pelo WhatsApp** | —                                                        | Copia / abre o WhatsApp com endereço do app + e-mail + senha                                     |
| 7   | Cadastrar outra pessoa com o **mesmo e-mail**                     | —                                                        | "Já existe uma conta com este e-mail."                                                           |
| 8   | Console: `supabase.functions.invoke('invite-member', …)`          | 403 "Você não tem permissão para cadastrar integrantes." | 201                                                                                              |

## Primeiro acesso da pessoa cadastrada

| #   | Passo                                                      | Esperado                                                                |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Entrar com o e-mail e a senha provisória                   | Tela **"Defina sua senha"**; sem menu; qualquer endereço volta para ela |
| 2   | Senha `curta1`                                             | "Use pelo menos 10 caracteres." (e as outras regras que faltarem)       |
| 3   | Senhas diferentes nos dois campos                          | "As senhas não são iguais."                                             |
| 4   | Senha válida (10+, letras e números) → **Salvar e entrar** | Abre o Início com o nome da pessoa                                      |
| 5   | Sair e entrar com a senha nova                             | Vai direto para o Início                                                |
| 6   | Console antes de trocar: `from('songs').select()`          | Lista vazia (o banco também bloqueia a conta com senha provisória)      |

## Trocar senha (Configurações, todos os perfis)

| #   | Passo                         | Esperado                                       |
| --- | ----------------------------- | ---------------------------------------------- |
| 1   | Senha atual errada            | "A senha atual está incorreta."                |
| 2   | Nova senha igual à atual      | "A nova senha precisa ser diferente da atual." |
| 3   | Tudo certo → **Trocar senha** | "Senha alterada."; entrar de novo com a nova   |

---

# Base ADVOP: perfis, nova música e atividade recente

Automatizado em `e2e/fluxos.mjs` (seções NOVA MÚSICA, LUCAS e ADMIN desktop),
`e2e/api-checks.mjs` e `supabase/tests/advop.test.sql`.

## Perfis e identidade

| #   | Passo                                       | Esperado                                                           |
| --- | ------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Título da aba e tela de login               | "Ministério de Louvor · ADVOP"                                     |
| 2   | Início no celular                           | "ADVOP" acima da saudação                                          |
| 3   | Instalar o app                              | Ícone com o nome "Louvor ADVOP"                                    |
| 4   | Integrantes                                 | Selos "Cantor(a)" e/ou "Instrumentista"; ninguém com "Liderança"   |
| 5   | Cadastrar integrante (admin)                | Perfis: Integrante e Administração                                 |
| 6   | Lucas (`lider@demo.local`) em Montar escala | "Você não tem permissão para montar escalas." (agora é integrante) |
| 7   | Montar escala (admin) → Cantores            | Só quem tem função vocal; Instrumentistas: só instrumental         |

## Nova música (`/repertorio/nova`, integrante)

| #   | Passo                                                               | Esperado                                                                      |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Repertório → **Nova música**                                        | Formulário (integrante e admin)                                               |
| 2   | Colar cifra com acordes em cima da letra, `[Refrão]`, `[Intro] G D` | "Formato detectado: acordes em cima da letra"; pré-visualização com as partes |
| 3   | Acorde que não existe (ex.: `Xyz` na linha de acordes)              | Não vira acorde (fica como texto); `[Xyz]` em ChordPro gera aviso             |
| 4   | "Tom detectado na cifra" → **usar**                                 | Preenche o tom original                                                       |
| 5   | Salvar sem letra                                                    | Abre a música; a aba Letra tem a letra gerada da cifra                        |
| 6   | Transpor, Editar cifra, Definir tom oficial, **Editar dados**       | Tudo salva para o integrante; **sem** botão Arquivar                          |
| 7   | Colar só letra (sem acordes)                                        | "sem acordes — será salvo como letra"                                         |

## Atividade recente (Mais → Atividade recente, só admin)

| #   | Passo                                 | Integrante                                                          | Admin                                               |
| --- | ------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | Menu Mais                             | **Sem** "Atividade recente"                                         | Com "Atividade recente"                             |
| 2   | Abrir `/atividade`                    | "Você não tem permissão para ver a atividade de todo o repertório." | Lista: música, o que mudou, quem e quando           |
| 3   | Filtro Pessoa / Música                | —                                                                   | Lista filtra                                        |
| 4   | Tocar num item                        | —                                                                   | Abre o histórico da música (onde restaura)          |
| 5   | Console: `rpc('get_recent_activity')` | 42501                                                               | Lista                                               |
| 6   | Histórico de uma música               | Visível (sem Restaurar)                                             | Visível com Restaurar                               |
| 7   | **Arquivar** (admin)                  | —                                                                   | Some do repertório; aparece "Arquivou" na atividade |
