-- =============================================================================
-- Privilégios de tabela (GRANT) de `authenticated` e `anon` no schema public.
-- RLS decide QUAIS linhas; o GRANT decide se a tabela/coluna pode ser tocada. Sem GRANT, o
-- PostgREST responde 403 (permission denied) antes de qualquer policy — foi o que aconteceu no
-- projeto da nuvem. As listas de tabelas e sequences são lidas do catálogo: tabela nova entra no
-- teste sozinha e precisa ter o GRANT esperado.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(
  (select count(*)::int * 2 from pg_tables where schemaname = 'public')
  + (select count(*)::int * 2 from pg_sequences where schemaname = 'public')
  + 10 -- colunas de profiles
  + 3 -- colunas de notifications
  + 5 -- RLS, schema e privilégios padrão
);

-- ---------------------------------------------------------------------------
-- authenticated: SELECT/INSERT/UPDATE/DELETE em toda tabela (nada de TRUNCATE etc.),
-- com as exceções de coluna de profiles e notifications.
-- ---------------------------------------------------------------------------
select table_privs_are(
  'public', t.tablename, 'authenticated',
  case t.tablename
    when 'profiles' then array[]::text[] -- só privilégios de coluna (ver abaixo)
    when 'notifications' then array['SELECT']
    else array['DELETE', 'INSERT', 'SELECT', 'UPDATE']
  end::name[],
  format('authenticated: privilégios de tabela em %s', t.tablename)
)
from pg_tables t
where t.schemaname = 'public'
order by t.tablename;

-- anon: nenhum privilégio em nenhuma tabela (o app sempre usa usuário logado).
select table_privs_are(
  'public', t.tablename, 'anon', array[]::name[],
  format('anon: nenhum privilégio em %s', t.tablename)
)
from pg_tables t
where t.schemaname = 'public'
order by t.tablename;

-- Sequences (colunas identity): authenticated usa; anon não.
select sequence_privs_are(
  'public', s.sequencename, 'authenticated', array['SELECT', 'USAGE']::name[],
  format('authenticated: usage/select na sequence %s', s.sequencename)
)
from pg_sequences s
where s.schemaname = 'public'
order by s.sequencename;

select sequence_privs_are(
  'public', s.sequencename, 'anon', array[]::name[],
  format('anon: nada na sequence %s', s.sequencename)
)
from pg_sequences s
where s.schemaname = 'public'
order by s.sequencename;

-- ---------------------------------------------------------------------------
-- profiles: phone NÃO é legível; só algumas colunas são editáveis.
-- ---------------------------------------------------------------------------
select column_privs_are(
  'public', 'profiles', c.col::name, 'authenticated', c.privs::name[],
  format('profiles.%s: %s', c.col, coalesce(nullif(array_to_string(c.privs, ', '), ''), 'nada'))
)
from (
  values
    ('id', array['SELECT']),
    ('full_name', array['SELECT', 'UPDATE']),
    ('display_name', array['SELECT', 'UPDATE']),
    ('phone', array['UPDATE']),
    ('access_role', array['SELECT', 'UPDATE']),
    ('is_owner', array['SELECT']),
    ('status', array['SELECT', 'UPDATE']),
    ('created_at', array['SELECT']),
    ('updated_at', array['SELECT']),
    ('must_change_password', array['SELECT']) -- só a RPC complete_password_change() altera
) as c(col, privs);

-- notifications: lê tudo, mas só atualiza read_at (inserção só por trigger).
select column_privs_are(
  'public', 'notifications', c.col::name, 'authenticated', c.privs::name[],
  format('notifications.%s: %s', c.col, array_to_string(c.privs, ', '))
)
from (
  values
    ('read_at', array['SELECT', 'UPDATE']),
    ('title', array['SELECT']),
    ('user_id', array['SELECT'])
) as c(col, privs);

-- ---------------------------------------------------------------------------
-- Gerais
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'toda tabela de public tem RLS ligado'
);

select ok(
  has_schema_privilege('authenticated', 'public', 'USAGE'),
  'authenticated tem usage no schema public'
);

-- Privilégios padrão (para tabelas que o postgres criar no futuro). Não substituem o GRANT
-- explícito em cada migration (regra do CLAUDE.md), só evitam um 403 se ele for esquecido.
select is(
  (
    select array_agg(distinct a.privilege_type order by a.privilege_type)
    from pg_default_acl d, aclexplode(d.defaclacl) a
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype = 'r'
      and a.grantee = 'authenticated'::regrole
  ),
  array['DELETE', 'INSERT', 'SELECT', 'UPDATE']::text[],
  'padrão: novas tabelas dão SELECT/INSERT/UPDATE/DELETE para authenticated'
);

select is(
  (
    select array_agg(distinct a.privilege_type order by a.privilege_type)
    from pg_default_acl d, aclexplode(d.defaclacl) a
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype = 'S'
      and a.grantee = 'authenticated'::regrole
  ),
  array['SELECT', 'USAGE']::text[],
  'padrão: novas sequences dão USAGE/SELECT para authenticated'
);

select is(
  (
    select count(*)::int
    from pg_default_acl d, aclexplode(d.defaclacl) a
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype in ('r', 'S')
      and a.grantee = 'anon'::regrole
  ),
  0,
  'padrão: nada para anon em tabelas e sequences novas'
);

select * from finish();
rollback;
