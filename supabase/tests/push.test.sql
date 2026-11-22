-- =============================================================================
-- Web Push: inscrições por aparelho e disparo para a Edge Function send-push (Fase H, item 19).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(11);

select set_config('request.jwt.claims', '', true);
insert into auth.users (id, email, instance_id, aud, role) values
  ('e1000000-0000-4000-8000-000000000001', 'ana@push.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('e1000000-0000-4000-8000-000000000002', 'bia@push.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.save_push_subscription('https://push.exemplo/ana', 'chave', 'auth', 'Celular')$$,
  'ativa os avisos neste aparelho');
select lives_ok($$select public.save_push_subscription('https://push.exemplo/ana', 'chave2', 'auth2')$$,
  'ativar de novo atualiza (sem duplicar)');
select is((select count(*)::int from public.push_subscriptions), 1, 'vê a própria inscrição');
select throws_ok($$insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://x', 'a', 'b')$$,
  '42501', null, 'gravar direto na tabela não pode (só pela RPC)');
select throws_ok($$select public.save_push_subscription('http://inseguro', 'a', 'b')$$,
  '23514', null, 'endpoint precisa ser https');

select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is_empty($$select 1 from public.push_subscriptions$$, 'outra pessoa não vê a inscrição');
select lives_ok($$select public.save_push_subscription('https://push.exemplo/bia', 'k', 'a')$$, 'Bia ativa');
select lives_ok($$delete from public.push_subscriptions where endpoint = 'https://push.exemplo/bia'$$,
  'e desativa');

reset role;
-- Sem os segredos no Vault: nada sai.
insert into public.notifications (user_id, type, title) values
  ('e1000000-0000-4000-8000-000000000001', 'teste', 'Sem segredo');
select is((select count(*)::int from net.http_request_queue where url = 'https://exemplo.test/send-push'), 0,
  'sem segredo no Vault: não chama a função');

select vault.create_secret('https://exemplo.test/send-push', 'send_push_url');
select vault.create_secret('segredo-de-teste', 'send_push_secret');
insert into public.notifications (user_id, type, title) values
  ('e1000000-0000-4000-8000-000000000001', 'teste', 'Com aparelho'),
  ('e1000000-0000-4000-8000-000000000002', 'teste', 'Sem aparelho');
select is((select count(*)::int from net.http_request_queue where url = 'https://exemplo.test/send-push'), 1,
  'só quem tem aparelho inscrito gera chamada');
select is((select headers ->> 'x-push-secret' from net.http_request_queue
           where url = 'https://exemplo.test/send-push'), 'segredo-de-teste', 'autenticada com o segredo do Vault');

select * from finish();
rollback;
