-- =============================================================================
-- USUÁRIOS DEMO — rode no SQL Editor do Supabase DEPOIS de criar os 3 usuários em
-- Authentication → Users → "Add user" (com "Auto Confirm User" marcado).
--
-- 1) Troque os e-mails abaixo pelos que você usou (placeholders: admin@demo, ...).
-- 2) Execute o script inteiro. Ele é idempotente: pode rodar de novo sem duplicar nada.
-- Os nomes são FICTÍCIOS.
-- =============================================================================

do $$
declare
  v_admin_email text := 'admin@demo.local';
  v_leader_email text := 'lider@demo.local';
  v_member_email text := 'integrante@demo.local';
  v_admin uuid;
  v_leader uuid;
  v_member uuid;
begin
  select id into v_admin from auth.users where email = v_admin_email;
  select id into v_leader from auth.users where email = v_leader_email;
  select id into v_member from auth.users where email = v_member_email;

  if v_admin is null or v_leader is null or v_member is null then
    raise exception 'Crie primeiro os 3 usuários no painel (Authentication → Users): %, %, %',
      v_admin_email, v_leader_email, v_member_email;
  end if;

  -- Usuários criados antes das migrations (ou com o trigger desativado) podem estar sem perfil.
  -- Cria só o que falta, do mesmo jeito que o trigger handle_new_user; os updates abaixo completam.
  insert into public.profiles (id, full_name, display_name)
  select u.id,
         coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
         u.raw_user_meta_data ->> 'display_name'
  from auth.users u
  where u.id in (v_admin, v_leader, v_member)
  on conflict (id) do nothing;

  update public.profiles set full_name = 'Ana Administradora', display_name = 'Ana',
    access_role = 'admin', is_owner = true, status = 'active', phone = '(00) 90000-0001'
  where id = v_admin;

  -- 'lider@demo.local' é só o e-mail antigo: o perfil "liderança" não é mais usado (é integrante).
  update public.profiles set full_name = 'Lucas Lima', display_name = 'Lucas',
    access_role = 'member', status = 'active', phone = '(00) 90000-0002'
  where id = v_leader;

  update public.profiles set full_name = 'Isa Integrante', display_name = 'Isa',
    access_role = 'member', status = 'active', phone = '(00) 90000-0003'
  where id = v_member;

  -- Funções no ministério
  insert into public.member_functions (user_id, function_id)
  select v_admin, id from public.ministry_functions where name in ('Teclado', 'Backing vocal')
  on conflict do nothing;
  insert into public.member_functions (user_id, function_id)
  select v_leader, id from public.ministry_functions where name in ('Vocal principal', 'Violão')
  on conflict do nothing;
  insert into public.member_functions (user_id, function_id)
  select v_member, id from public.ministry_functions where name in ('Bateria')
  on conflict do nothing;

  -- Escalas nos eventos do seed (gera notificações pelos triggers)
  insert into public.event_assignments (event_id, user_id, function_id)
  select e.id, a.user_id, f.id
  from (values
    ('10000000-0000-4000-8000-000000000001'::uuid, v_leader, 'Vocal principal'),
    ('10000000-0000-4000-8000-000000000001'::uuid, v_member, 'Bateria'),
    ('10000000-0000-4000-8000-000000000002'::uuid, v_leader, 'Vocal principal'),
    ('10000000-0000-4000-8000-000000000002'::uuid, v_admin, 'Teclado'),
    ('10000000-0000-4000-8000-000000000002'::uuid, v_member, 'Bateria'),
    ('10000000-0000-4000-8000-000000000004'::uuid, v_admin, 'Backing vocal'),
    ('10000000-0000-4000-8000-000000000004'::uuid, v_member, 'Bateria')
  ) as a(event_id, user_id, function_name)
  join public.events e on e.id = a.event_id
  join public.ministry_functions f on f.name = a.function_name
  on conflict do nothing;
end;
$$;
