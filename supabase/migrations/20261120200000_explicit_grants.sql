-- =============================================================================
-- GRANT explícito para `authenticated` no schema public.
--
-- Por quê: projetos NOVOS do Supabase não concedem mais SELECT/INSERT/UPDATE/DELETE nas
-- tabelas de public para anon/authenticated (o Supabase local ainda concede). Sem o privilégio
-- de tabela, o PostgREST responde 403 antes de chegar no RLS. O RLS continua decidindo QUAIS
-- linhas cada um vê/altera; o GRANT só permite tocar na tabela.
--
-- Idempotente: só GRANT/REVOKE/ALTER DEFAULT PRIVILEGES, e o resultado final é sempre o mesmo,
-- tenha ou não havido correção manual antes (como no projeto da nuvem em 20/11/2026).
-- Ordem: zera tudo de anon/authenticated → concede o padrão → reaplica as restrições de coluna.
-- =============================================================================

-- Schema ----------------------------------------------------------------------------------------
grant usage on schema public to authenticated;

-- Tabelas e sequences existentes: estado conhecido (inclui tirar TRUNCATE/REFERENCES/TRIGGER que
-- o Supabase local concede, e qualquer privilégio de coluna antigo).
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Privilégios padrão para tabelas/sequences que o postgres criar no futuro. Rede de segurança:
-- a regra do projeto continua sendo GRANT explícito em toda tabela nova (CLAUDE.md).
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to authenticated;

-- profiles: phone não é legível pela API (só via get_member_contacts); só algumas colunas são
-- editáveis (access_role/status ainda passam pelo trigger guard_profile_update). Sem
-- insert/delete: o perfil nasce pelo trigger handle_new_user.
revoke all on public.profiles from authenticated;
grant select (id, full_name, display_name, access_role, is_owner, status, created_at, updated_at)
  on public.profiles to authenticated;
grant update (full_name, display_name, phone, access_role, status)
  on public.profiles to authenticated;

-- notifications: cada um lê as suas (RLS) e só marca como lida; inserção só por trigger.
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
