-- =============================================================================
-- SEED de demonstração (roda em `supabase db reset` e no `supabase start`).
-- Conteúdo: SOMENTE hinos em domínio público (textos anteriores a 1929, só a 1ª estrofe)
-- e textos fictícios. Nenhuma pessoa real. Usuários demo: ver supabase/demo-users.sql.
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
insert into public.songs (id, title, artist, category, original_key, official_key, notes) values
  ('00000000-0000-4000-8000-000000000001', 'Amazing Grace', 'John Newton (1779)', 'Hino', 'G', 'G', 'Domínio público'),
  ('00000000-0000-4000-8000-000000000002', 'Holy, Holy, Holy', 'Reginald Heber (1826)', 'Adoração', 'D', 'D', 'Domínio público'),
  ('00000000-0000-4000-8000-000000000003', 'A Mighty Fortress Is Our God', 'Martinho Lutero (1529), trad. F. H. Hedge (1853)', 'Hino', 'C', 'C', 'Domínio público — "Castelo Forte"'),
  ('00000000-0000-4000-8000-000000000004', 'Joy to the World', 'Isaac Watts (1719)', 'Natal', 'D', 'D', 'Domínio público'),
  ('00000000-0000-4000-8000-000000000005', 'Rock of Ages', 'Augustus Toplady (1763)', 'Hino', 'C', null, 'Domínio público'),
  ('00000000-0000-4000-8000-000000000006', 'It Is Well with My Soul', 'Horatio Spafford (1873)', 'Hino', 'C', 'C', 'Domínio público'),
  ('00000000-0000-4000-8000-000000000007', 'Blessed Assurance', 'Fanny Crosby (1873)', 'Louvor', 'D', 'D', 'Domínio público'),
  ('00000000-0000-4000-8000-000000000008', 'Come, Thou Fount of Every Blessing', 'Robert Robinson (1758)', 'Louvor', 'D', null, 'Domínio público'),
  ('00000000-0000-4000-8000-000000000009', 'Doxology', 'Thomas Ken (1674)', 'Adoração', 'G', 'G', 'Domínio público'),
  ('00000000-0000-4000-8000-000000000010', 'O Come, All Ye Faithful', 'Frederick Oakeley (1841)', 'Natal', 'G', 'G', 'Domínio público'),
  ('00000000-0000-4000-8000-000000000011', 'Cântico da Manhã (exemplo)', 'Texto fictício de demonstração', 'Louvor', 'E', 'E', 'Texto fictício — exercita acordes 7M, 7(9), m7(b5)'),
  ('00000000-0000-4000-8000-000000000012', 'Ao Deus Fiel (exemplo)', 'Texto fictício de demonstração', 'Adoração', 'A', 'A', 'Texto fictício — exercita baixo invertido')
on conflict (id) do nothing;

insert into public.song_lyrics (song_id, content) values
  ('00000000-0000-4000-8000-000000000001', $t$Amazing grace! How sweet the sound
That saved a wretch like me!
I once was lost, but now am found;
Was blind, but now I see.$t$),
  ('00000000-0000-4000-8000-000000000002', $t$Holy, holy, holy! Lord God Almighty!
Early in the morning our song shall rise to Thee;
Holy, holy, holy, merciful and mighty!
God in three Persons, blessed Trinity!$t$),
  ('00000000-0000-4000-8000-000000000003', $t$A mighty fortress is our God,
A bulwark never failing;
Our helper He, amid the flood
Of mortal ills prevailing.$t$),
  ('00000000-0000-4000-8000-000000000004', $t$Joy to the world, the Lord is come!
Let earth receive her King;
Let every heart prepare Him room,
And heaven and nature sing.$t$),
  ('00000000-0000-4000-8000-000000000005', $t$Rock of Ages, cleft for me,
Let me hide myself in Thee;
Let the water and the blood,
From Thy wounded side which flowed.$t$),
  ('00000000-0000-4000-8000-000000000006', $t$When peace, like a river, attendeth my way,
When sorrows like sea billows roll;
Whatever my lot, Thou hast taught me to say,
It is well, it is well with my soul.$t$),
  ('00000000-0000-4000-8000-000000000007', $t$Blessed assurance, Jesus is mine!
O what a foretaste of glory divine!
Heir of salvation, purchase of God,
Born of His Spirit, washed in His blood.$t$),
  ('00000000-0000-4000-8000-000000000008', $t$Come, Thou Fount of every blessing,
Tune my heart to sing Thy grace;
Streams of mercy, never ceasing,
Call for songs of loudest praise.$t$),
  ('00000000-0000-4000-8000-000000000009', $t$Praise God, from whom all blessings flow;
Praise Him, all creatures here below;
Praise Him above, ye heavenly host;
Praise Father, Son, and Holy Ghost.$t$),
  ('00000000-0000-4000-8000-000000000010', $t$O come, all ye faithful, joyful and triumphant,
O come ye, O come ye to Bethlehem;
Come and behold Him, born the King of angels;
O come, let us adore Him, Christ the Lord.$t$),
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
  ('00000000-0000-4000-8000-000000000001', $c${title: Amazing Grace}
{key: G}
A[G]mazing [G7]grace! How [C]sweet the [G]sound
That [G]saved a wretch like [D]me!
I [G]once was [G7]lost, but [C]now am [G]found;
Was [Em]blind, but [D]now I [G]see.$c$, 'official'),
  ('00000000-0000-4000-8000-000000000002', $c${title: Holy, Holy, Holy}
{key: D}
[D]Holy, holy, [Bm]holy! [G]Lord God Al[D]mighty!
[A]Early in the [D]morning our [G]song shall [E]rise to [A]Thee;
[D]Holy, holy, [Bm]holy, [G]merciful and [D]mighty!
[G]God in three [D]Persons, [Bm]bless[G]ed [A]Trini[D]ty!$c$, 'official'),
  ('00000000-0000-4000-8000-000000000003', $c${title: A Mighty Fortress Is Our God}
{key: C}
A [C]mighty [G]fortress [C]is our [F]God,
A [C]bulwark [G]never [C]failing;
Our [C]helper [G]He, a[C]mid the [F]flood
Of [C]mortal [G]ills pre[C]vailing.$c$, 'official'),
  ('00000000-0000-4000-8000-000000000004', $c${title: Joy to the World}
{key: D}
[D]Joy to the world, the [G]Lord [A]is [D]come!
Let [D]earth receive her [A]King;
Let [D]every heart prepare Him room,
And [D]heaven and nature sing.$c$, 'official'),
  ('00000000-0000-4000-8000-000000000005', $c${title: Rock of Ages}
{key: C}
[C]Rock of Ages, [G]cleft for [C]me,
Let me [F]hide my[C]self in [G]Thee;
[C]Let the water [G]and the blood,
[C]From Thy wounded [G]side which [C]flowed.$c$, 'pending'),
  ('00000000-0000-4000-8000-000000000006', $c${title: It Is Well with My Soul}
{key: C}
When [C]peace, like a [Am]river, at[F]tendeth my [C]way,
When [C]sorrows like [Am]sea billows [D7]roll;[G]
What[C]ever my [F]lot, Thou hast [Dm]taught me to [G]say,
It is [C]well, it is [F]well with my [G7]soul.[C]$c$, 'official'),
  ('00000000-0000-4000-8000-000000000007', $c${title: Blessed Assurance}
{key: D}
[D]Blessed as[G]surance, [D]Jesus is mine!
O [D]what a fore[A]taste of glory di[D]vine!
[D]Heir of sal[G]vation, [D]purchase of God,
[G]Born of His [D]Spirit, [A]washed in His [D]blood.$c$, 'official'),
  ('00000000-0000-4000-8000-000000000008', $c${title: Come, Thou Fount of Every Blessing}
{key: D}
[D]Come, Thou Fount of [G]every [D]blessing,
[D]Tune my heart to [A]sing Thy [D]grace;
[D]Streams of mercy, [G]never [D]ceasing,
[D]Call for songs of [A]loudest [D]praise.$c$, 'official'),
  ('00000000-0000-4000-8000-000000000009', $c${title: Doxology}
{key: G}
[G]Praise God, from [D]whom all [Em]blessings [D]flow;
[G]Praise Him, all [C]creatures [D]here be[G]low;
[G]Praise Him a[D]bove, ye [Em]heavenly [D]host;
[G]Praise Father, [C]Son, and [D]Holy [G]Ghost.$c$, 'official'),
  ('00000000-0000-4000-8000-000000000010', $c${title: O Come, All Ye Faithful}
{key: G}
O [G]come, all ye [D]faithful, [G]joyful and [D]tri[G]umphant,
O [Em]come ye, O [D]come ye to [A]Beth[D]lehem;
[G]Come and be[D]hold Him, [G]born the [C]King of [D]angels;
O [G]come, let us a[D]dore Him, [G]Christ [D]the [G]Lord.$c$, 'official'),
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
