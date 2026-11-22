-- =============================================================================
-- WEB PUSH (Fase H, item 19).
--
-- push_subscriptions: um registro por aparelho que ativou "Receber avisos no celular".
-- Cada notificação nova (AFTER INSERT em notifications) chama a Edge Function send-push pelo
-- pg_net, autenticada com um segredo guardado no Vault. Sem os segredos no Vault, nada é
-- enviado (o app continua com o sino). A função apaga as inscrições que voltam 404/410.
--
-- Segredos (o dono cadastra; nada disso fica no repositório):
--   vault: send_push_url    = https://<ref>.supabase.co/functions/v1/send-push
--   vault: send_push_secret = o mesmo valor de PUSH_WEBHOOK_SECRET nas Edge Functions
-- =============================================================================

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
-- Gravar passa pela RPC save_push_subscription (o mesmo aparelho pode trocar de conta).
grant select, delete on public.push_subscriptions to authenticated;

drop policy if exists "push_subscriptions: dono lê" on public.push_subscriptions;
create policy "push_subscriptions: dono lê"
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "push_subscriptions: dono remove" on public.push_subscriptions;
create policy "push_subscriptions: dono remove"
  on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Ativar neste aparelho: o endpoint passa a ser da pessoa logada (sai de quem usava antes).
create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_member() then
    raise exception 'Entre com uma conta ativa para receber avisos.' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- Notificação nova → send-push (assíncrono; nunca impede a notificação de ser gravada).
create or replace function public.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.push_subscriptions s where s.user_id = new.user_id) then
    return null;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'send_push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'send_push_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret)
  );
  return null;
exception when others then
  -- Push é um extra: falha no envio não pode desfazer a notificação.
  return null;
end;
$$;
revoke execute on function public.dispatch_push() from public, anon, authenticated;

drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push
after insert on public.notifications
for each row execute function public.dispatch_push();
