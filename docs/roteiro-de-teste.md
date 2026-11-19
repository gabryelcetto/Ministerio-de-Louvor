# Roteiro de teste das telas de leitura (fase E)

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

| #   | Passo                | Integrante                                             | Admin                    |
| --- | -------------------- | ------------------------------------------------------ | ------------------------ |
| 1   | Tocar em "Mais"      | Abre painel com Notificações, Comunicados, Integrantes | Idem + **Configurações** |
| 2   | Esc / tocar fora / ✕ | Fecha e o foco volta ao botão "Mais"                   | Idem                     |
| 3   | Estar em Comunicados | "Mais" aparece como ativo na barra                     | Idem                     |

## Estados comuns (todas as telas)

- **Carregando:** com a rede em "Slow 3G" (DevTools), aparece "Carregando…".
- **Erro:** com a rede "Offline", aparece a mensagem e o botão **"Tentar de novo"**; voltar a rede
  e tocar no botão carrega a tela.
- **Vazio:** com o banco sem dados (antes do `demo-users.sql`), cada lista mostra a sua mensagem.
