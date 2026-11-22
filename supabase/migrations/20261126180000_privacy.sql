-- =============================================================================
-- PRIVACIDADE (LGPD): aceite da política no primeiro acesso (Fase G, item 15).
-- A pessoa marca "Li e concordo"; guardamos a data e a versão da política aceita.
-- Só a própria pessoa registra (RPC accept_privacy); a coluna não é editável pela API.
-- =============================================================================

alter table public.profiles
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists privacy_version text;

grant select (privacy_accepted_at, privacy_version) on public.profiles to authenticated;

create or replace function public.accept_privacy(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Faça login para continuar.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_version), '') = '' or char_length(p_version) > 20 then
    raise exception 'Versão da política inválida.' using errcode = '22023';
  end if;
  update public.profiles
  set privacy_accepted_at = now(), privacy_version = btrim(p_version)
  where id = (select auth.uid());
end;
$$;

revoke execute on function public.accept_privacy(text) from public, anon;
grant execute on function public.accept_privacy(text) to authenticated;
