-- =============================================================================
-- SEED de demonstração (roda em `supabase db reset` e no `supabase start`).
-- Conteúdo: SOMENTE hinos em português em domínio público (autor do texto em português
-- falecido há mais de 70 anos; só a 1ª estrofe) e textos fictícios marcados "(exemplo)".
-- Nenhuma pessoa real. Usuários demo: ver supabase/demo-users.sql.
-- =============================================================================

-- Permissões -------------------------------------------------------------------------
insert into public.permissions (key, description) values
  ('schedules.manage', 'Criar e editar escalas e o repertório dos eventos'),
  ('events.manage', 'Criar, editar e cancelar eventos da agenda'),
  ('announcements.manage', 'Publicar e editar comunicados'),
  ('songs.delete', 'Excluir músicas do repertório'),
  ('chords.edit_official', 'Editar e aprovar a cifra oficial'),
  ('songs.set_official_key', 'Definir o tom oficial da música'),
  ('members.view_contacts', 'Ver telefone dos integrantes'),
  ('members.manage', 'Gerenciar integrantes, perfis e funções'),
  ('permissions.manage', 'Gerenciar permissões por perfil e por usuário'),
  ('history.restore', 'Restaurar versões antigas de letra, cifra e tom')
on conflict (key) do nothing;

-- admin recebe todas; líder, as operacionais; integrante, nenhuma extra.
insert into public.role_permissions (role, permission_key)
select 'admin', key from public.permissions
on conflict do nothing;

insert into public.role_permissions (role, permission_key) values
  ('leader', 'schedules.manage'),
  ('leader', 'events.manage'),
  ('leader', 'announcements.manage'),
  ('leader', 'chords.edit_official'),
  ('leader', 'songs.set_official_key'),
  ('leader', 'members.view_contacts'),
  ('leader', 'history.restore')
on conflict do nothing;

-- Funções do ministério --------------------------------------------------------------
insert into public.ministry_functions (name, sort_order) values
  ('Vocal principal', 1),
  ('Backing vocal', 2),
  ('Violão', 3),
  ('Guitarra', 4),
  ('Teclado', 5),
  ('Baixo', 6),
  ('Bateria', 7),
  ('Outros', 8)
on conflict (name) do nothing;

-- Músicas ----------------------------------------------------------------------------
-- Hinos em português SÓ quando o autor do texto em português morreu há mais de 70 anos
-- (antes de 1956); autorias conferidas no hymnary.org. Só a 1ª estrofe, na forma tradicional.
-- Todo o resto é texto fictício escrito para a demonstração e marcado "(exemplo)".
insert into public.songs (id, title, artist, category, original_key, official_key, notes) values
  ('00000000-0000-4000-8000-000000000001', 'Graça Sem Fim (exemplo)', 'Texto fictício de demonstração', 'Hino', 'G', 'G', 'Texto fictício'),
  ('00000000-0000-4000-8000-000000000002', 'Santo! Santo! Santo!', 'Reginald Heber (1826), trad. João Gomes da Rocha (1861–1947)', 'Adoração', 'D', 'D', 'Domínio público — tradução de 1888'),
  ('00000000-0000-4000-8000-000000000003', 'Rocha Firme (exemplo)', 'Texto fictício de demonstração', 'Hino', 'C', 'C', 'Texto fictício'),
  ('00000000-0000-4000-8000-000000000004', 'Nasceu o Salvador (exemplo)', 'Texto fictício de demonstração', 'Natal', 'D', 'D', 'Texto fictício'),
  ('00000000-0000-4000-8000-000000000005', 'Mais Perto Quero Estar', 'Sarah F. Adams (1841), trad. João Gomes da Rocha (1861–1947)', 'Hino', 'C', null, 'Domínio público — cifra enviada por integrante, aguardando revisão'),
  ('00000000-0000-4000-8000-000000000006', 'Sou Feliz com Jesus', 'Horatio G. Spafford (1873), trad. W. E. Entzminger (1859–1930)', 'Hino', 'C', 'C', 'Domínio público'),
  ('00000000-0000-4000-8000-000000000007', 'Certeza Bendita (exemplo)', 'Texto fictício de demonstração', 'Louvor', 'D', 'D', 'Texto fictício'),
  ('00000000-0000-4000-8000-000000000008', 'Fonte de Bênçãos (exemplo)', 'Texto fictício de demonstração', 'Louvor', 'D', null, 'Texto fictício'),
  ('00000000-0000-4000-8000-000000000009', 'Doxologia', 'Thomas Ken (1674), trad. Sarah P. Kalley (1825–1907)', 'Adoração', 'G', 'G', 'Domínio público — tradução de 1861'),
  ('00000000-0000-4000-8000-000000000010', 'Vinde Adorar (exemplo)', 'Texto fictício de demonstração', 'Natal', 'G', 'G', 'Texto fictício'),
  ('00000000-0000-4000-8000-000000000011', 'Cântico da Manhã (exemplo)', 'Texto fictício de demonstração', 'Louvor', 'E', 'E', 'Texto fictício — exercita acordes 7M, 7(9), m7(b5)'),
  ('00000000-0000-4000-8000-000000000012', 'Ao Deus Fiel (exemplo)', 'Texto fictício de demonstração', 'Adoração', 'A', 'A', 'Texto fictício — exercita baixo invertido')
on conflict (id) do nothing;

insert into public.song_lyrics (song_id, content) values
  ('00000000-0000-4000-8000-000000000001', $t$Sem fim é a graça que me alcançou,
Do pó da estrada o Senhor me ergueu;
Perdido estava e ele me achou,
E hoje canto o amor que me deu.$t$),
  ('00000000-0000-4000-8000-000000000002', $t$Santo! Santo! Santo! Deus onipotente!
Cedo de manhã cantaremos teu louvor;
Santo! Santo! Santo! Deus Jeová triúno,
És um só Deus, excelso Criador.$t$),
  ('00000000-0000-4000-8000-000000000003', $t$Rocha firme é o nosso Deus,
Abrigo em meio ao vendaval;
Quem nele espera não temerá,
Pois seu amor é sem igual.$t$),
  ('00000000-0000-4000-8000-000000000004', $t$Nasceu na noite o Salvador,
Os céus se enchem de canção;
Pastores correm com fervor
Para adorar com o coração.$t$),
  ('00000000-0000-4000-8000-000000000005', $t$Mais perto quero estar, meu Deus, de ti,
Inda que seja a dor que me una a ti;
Sempre hei de suplicar:
Mais perto quero estar,
Mais perto quero estar, meu Deus, de ti!$t$),
  ('00000000-0000-4000-8000-000000000006', $t$Se paz a mais doce me deres gozar,
Se dor a mais forte sofrer,
Oh! seja o que for, tu me fazes saber
Que feliz com Jesus sempre sou!$t$),
  ('00000000-0000-4000-8000-000000000007', $t$Tenho a certeza: Jesus é meu!
Paz que o mundo jamais me deu;
Sou seu herdeiro, por graça e fé,
Nele descanso, firme de pé.$t$),
  ('00000000-0000-4000-8000-000000000008', $t$Vem, ó fonte de alegria,
Ensina-me a te louvar;
Tua graça, noite e dia,
Faz meu coração cantar.$t$),
  ('00000000-0000-4000-8000-000000000009', $t$A Deus, supremo Benfeitor,
Vós, anjos e homens, dai louvor;
A Deus o Filho, a Deus o Pai,
E a Deus Espírito, glória dai.$t$),
  ('00000000-0000-4000-8000-000000000010', $t$Vinde, ó povo, cheio de alegria,
Vinde depressa ver o Rei que nasceu;
Vinde adorá-lo, luz da profecia,
Vinde adorar o Filho que Deus nos deu.$t$),
  ('00000000-0000-4000-8000-000000000011', $t$Desperta, ó alma, que a manhã chegou,
Canta ao Senhor que a noite dissipou;
Cada novo dia é um dom de amor,
Rende graças sempre ao teu Criador.$t$),
  ('00000000-0000-4000-8000-000000000012', $t$Ao Deus fiel, que nunca falhará,
Erguemos hoje a nossa gratidão;
Sua bondade sempre durará,
De geração em geração.$t$)
on conflict (song_id) do nothing;

insert into public.song_chords (song_id, content, review_status) values
  ('00000000-0000-4000-8000-000000000001', $c${title: Graça Sem Fim (exemplo)}
{key: G}
Sem [G]fim é a [G7]graça que me al[C]cançou[G],
Do [G]pó da es[Em]trada o Se[D]nhor me ergueu;
Per[G]dido es[G7]tava e [C]ele me a[G]chou,
E [Em]hoje [D]canto o amor que me [G]deu.$c$, 'official'),
  ('00000000-0000-4000-8000-000000000002', $c${title: Santo! Santo! Santo!}
{key: D}
[D]Santo! Santo! [Bm]Santo! [G]Deus oni[D]potente!
[A]Cedo de ma[D]nhã canta[G]remos [E]teu lou[A]vor;
[D]Santo! Santo! [Bm]Santo! [G]Deus Jeo[D]vá tri[A]úno,
[G]És um só [D]Deus, ex[Bm]celso [G]Cri[A]a[D]dor.$c$, 'official'),
  ('00000000-0000-4000-8000-000000000003', $c${title: Rocha Firme (exemplo)}
{key: C}
[C]Rocha [G]firme é o [C]nosso [F]Deus,
A[C]brigo em [G]meio ao venda[C]val;
Quem [C]nele es[G]pera não [Am]teme[F]rá,
Pois [C]seu a[G]mor é sem i[C]gual.$c$, 'official'),
  ('00000000-0000-4000-8000-000000000004', $c${title: Nasceu o Salvador (exemplo)}
{key: D}
[D]Nasceu na noite o [G]Salva[A]dor[D],
Os [D]céus se enchem de [A]canção;
Pas[D]tores correm [G]com fer[D]vor
Para ado[G]rar com o [A]cora[D]ção.$c$, 'official'),
  ('00000000-0000-4000-8000-000000000005', $c${title: Mais Perto Quero Estar}
{key: C}
Mais [C]perto quero es[F]tar, meu [C]Deus, de [G]ti,
Inda que [C]seja a [F]dor que me [C]una a [G]ti;[C]
[C]Sempre hei de supli[G]car:
[C]Mais perto quero es[G]tar,
Mais [C]perto quero es[F]tar, meu [C]Deus, [G]de [C]ti!$c$, 'pending'),
  ('00000000-0000-4000-8000-000000000006', $c${title: Sou Feliz com Jesus}
{key: C}
Se [C]paz a mais [Am]doce me [F]deres go[C]zar,
Se [C]dor a mais [Am]forte so[D7]frer,[G]
Oh! [C]seja o que [F]for, tu me [Dm]fazes sa[G]ber
Que fe[C]liz com Je[F]sus sempre [G7]sou![C]$c$, 'official'),
  ('00000000-0000-4000-8000-000000000007', $c${title: Certeza Bendita (exemplo)}
{key: D}
[D]Tenho a cer[G]teza: Je[D]sus é meu!
[D]Paz que o mundo ja[A]mais me deu;
[D]Sou seu her[G]deiro, por [D]graça e fé,
[G]Nele des[D]canso, [A]firme de [D]pé.$c$, 'official'),
  ('00000000-0000-4000-8000-000000000008', $c${title: Fonte de Bênçãos (exemplo)}
{key: D}
[D]Vem, ó fonte de a[G]legri[D]a,
[D]Ensina-me a te [A]lou[D]var;
[D]Tua graça, noite e [G]di[D]a,
[D]Faz meu coração [A]can[D]tar.$c$, 'official'),
  ('00000000-0000-4000-8000-000000000009', $c${title: Doxologia}
{key: G}
[G]A Deus, su[D]premo [Em]Benfei[D]tor,
[G]Vós, anjos e [C]homens, [D]dai lou[G]vor;
[G]A Deus o [D]Filho, a [Em]Deus o [D]Pai,
[G]E a Deus Es[C]pírito, [D]glória [G]dai.$c$, 'official'),
  ('00000000-0000-4000-8000-000000000010', $c${title: Vinde Adorar (exemplo)}
{key: G}
[G]Vinde, ó povo, [D]cheio de a[G]legri[D]a[G],
[Em]Vinde de[D]pressa ver o [A]Rei que nas[D]ceu;
[G]Vinde ado[D]rá-lo, [G]luz da pro[C]feci[D]a,
[G]Vinde ado[D]rar o Filho que [G]Deus [D]nos [G]deu.$c$, 'official'),
  ('00000000-0000-4000-8000-000000000011', $c${title: Cântico da Manhã (exemplo)}
{key: E}
Des[E7M]perta, ó alma, que a ma[A7M]nhã chegou,
[G#m7]Canta ao Se[C#m7]nhor que a noite [F#7(9)]dissipou;
[A7M]Cada novo [G#m7]dia é um [C#m7]dom de amor,
[F#m7(b5)]Rende graças [B7sus4]sempre ao [B7]teu Cria[E]dor.$c$, 'official'),
  ('00000000-0000-4000-8000-000000000012', $c${title: Ao Deus Fiel (exemplo)}
{key: A}
Ao [A]Deus fiel, que [E/G#]nunca falha[F#m]rá,
Er[D]guemos hoje a [A/C#]nossa grati[E]dão;
Sua [A]bondade [A/G]sempre dura[D/F#]rá,
De [Dm]gera[A/E]ção em [E]gera[A]ção.$c$, 'official')
on conflict (song_id) do nothing;

-- Agenda: próximas 2 semanas, relativas à data em que o seed roda ---------------------
insert into public.events (id, type, title, starts_at, ends_at, location, notes) values
  ('10000000-0000-4000-8000-000000000001', 'ensaio', 'Ensaio geral',
    ((current_date + 2) + time '19:30') at time zone 'America/Sao_Paulo',
    ((current_date + 2) + time '21:30') at time zone 'America/Sao_Paulo',
    'Templo — salão principal', 'Passar as músicas do culto de domingo.'),
  ('10000000-0000-4000-8000-000000000002', 'culto', 'Culto de celebração',
    ((current_date + 4) + time '19:00') at time zone 'America/Sao_Paulo',
    ((current_date + 4) + time '21:00') at time zone 'America/Sao_Paulo',
    'Templo', null),
  ('10000000-0000-4000-8000-000000000003', 'ensaio', 'Ensaio de vozes',
    ((current_date + 8) + time '20:00') at time zone 'America/Sao_Paulo',
    ((current_date + 8) + time '21:30') at time zone 'America/Sao_Paulo',
    'Sala 2', 'Somente vocais.'),
  ('10000000-0000-4000-8000-000000000004', 'culto', 'Culto da família',
    ((current_date + 11) + time '10:00') at time zone 'America/Sao_Paulo',
    ((current_date + 11) + time '12:00') at time zone 'America/Sao_Paulo',
    'Templo', null),
  ('10000000-0000-4000-8000-000000000005', 'evento', 'Noite de louvor',
    ((current_date + 13) + time '19:30') at time zone 'America/Sao_Paulo',
    ((current_date + 13) + time '22:00') at time zone 'America/Sao_Paulo',
    'Praça central (evento externo)', 'Levar extensões e cabos.')
on conflict (id) do nothing;

insert into public.event_songs (event_id, song_id, position, key_for_event) values
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000009', 1, 'G'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 2, 'D'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000006', 3, 'D'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 4, 'A'),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000007', 1, null),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', 2, null),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000012', 3, 'G')
on conflict do nothing;

-- Comunicados -----------------------------------------------------------------------
insert into public.announcements (title, body, published_at) values
  ('Bem-vindos à nova plataforma',
   'A partir de agora as escalas, o repertório e as cifras ficam todos aqui. Dúvidas? Fale com a liderança.',
   now() - interval '2 days'),
  ('Ensaio geral confirmado',
   'O ensaio desta semana está confirmado. Chegue 15 minutos antes para passar o som.',
   now() - interval '1 day'),
  ('Novas músicas no repertório',
   'Adicionamos hinos clássicos ao repertório. Confira as cifras e o tom oficial de cada um.',
   now() - interval '3 hours');
