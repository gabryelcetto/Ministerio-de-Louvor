-- =============================================================================
-- SÓ PARA CI/E2E (e para testar localmente): faz o Supabase LOCAL se comportar como um
-- projeto NOVO da nuvem, que não concede privilégios de tabela em `public` para `anon` e
-- `authenticated`. O Supabase local concede tudo por padrão, o que escondeu a falta de GRANT.
--
-- Como usar: copie para supabase/migrations/00000000000000_simular_nuvem.sql ANTES de
-- `supabase start`/`supabase db start`. O nome com zeros faz rodar antes de todas as migrations;
-- assim, toda tabela criada depois só tem os privilégios que as migrations concederem.
-- O arquivo copiado está no .gitignore: NUNCA commite em supabase/migrations.
-- =============================================================================

-- Privilégios padrão: tabelas e sequences criadas daqui em diante (pelo postgres, que roda as
-- migrations) não ganham nada automaticamente para anon/authenticated.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- E nada que já exista (num banco novo não há tabelas em public, mas fica explícito).
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
