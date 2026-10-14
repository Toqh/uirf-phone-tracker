begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@example.test', crypt('test-password', gen_salt('bf')), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Admin"}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'supervisor@example.test', crypt('test-password', gen_salt('bf')), '{"provider":"email","providers":["email"]}', '{"full_name":"Read Only"}', now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'pending@example.test', crypt('test-password', gen_salt('bf')), '{"provider":"email","providers":["email"]}', '{"full_name":"Pending User","role":"admin","status":"approved"}', now(), now());

select is((select role::text from public.profiles where id = '10000000-0000-0000-0000-000000000003'), 'supervisor', 'signup metadata cannot set Admin role');
select is((select status::text from public.profiles where id = '10000000-0000-0000-0000-000000000003'), 'pending', 'new account remains pending');

update public.profiles set role = 'admin', status = 'approved', approved_at = now(), approved_by = id where id = '10000000-0000-0000-0000-000000000001';
update public.profiles set status = 'approved', approved_at = now(), approved_by = '10000000-0000-0000-0000-000000000001' where id = '10000000-0000-0000-0000-000000000002';
insert into public.supervisors(id, supervisor_code, full_name, created_by, updated_by) values('20000000-0000-0000-0000-000000000001','SUP-001','Directory Supervisor','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
insert into public.enumerators(id, enumerator_code, full_name, usual_supervisor_id, created_by, updated_by) values('30000000-0000-0000-0000-000000000001','ENU-001','Test Enumerator','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
insert into public.phones(id, serial_number, created_by) values('40000000-0000-0000-0000-000000000001','007','10000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select results_eq('select count(*) from public.phones', array[0::bigint], 'pending account cannot read phones');
select throws_ok($$select public.add_phone('008')$$, '42501', 'Not authorised: an approved Admin is required', 'pending account cannot add a phone');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select results_eq('select count(*) from public.phones', array[1::bigint], 'approved Supervisor can read phones');
select throws_ok($$select public.add_phone('008')$$, '42501', 'Not authorised: an approved Admin is required', 'Supervisor cannot write through RPC');
select throws_ok($$select public.promote_to_admin('10000000-0000-0000-0000-000000000002')$$, '42501', 'Not authorised: an approved Admin is required', 'Supervisor cannot self-promote');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$select public.issue_phone('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001')$$, 'P0001', 'Phone is not configured', 'unconfigured phone cannot be issued');
select lives_ok($$select public.configure_phone('40000000-0000-0000-0000-000000000001',true,true,true,true,null)$$, 'Admin can complete readiness checklist');
select is((select status::text from public.phones where id = '40000000-0000-0000-0000-000000000001'), 'available', 'configured phone becomes available');
select lives_ok($$select public.issue_phone('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001')$$, 'available phone can be issued');
select is((select count(*) from public.checkouts where phone_id = '40000000-0000-0000-0000-000000000001' and returned_at is null), 1::bigint, 'only one active checkout exists');
select throws_ok($$select public.issue_phone('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001')$$, 'P0001', 'Phone is not available', 'already-issued phone cannot be issued again');
select lives_ok($$select public.return_phone((select id from public.checkouts where phone_id = '40000000-0000-0000-0000-000000000001' and returned_at is null),false,null)$$, 'return closes the active checkout');
select is((select returned_by::text from public.checkouts where phone_id = '40000000-0000-0000-0000-000000000001'), '10000000-0000-0000-0000-000000000001', 'return records receiving Admin');
select is((select serial_number from public.phones where id = '40000000-0000-0000-0000-000000000001'), '007', 'leading zero remains stored');

select * from finish();
rollback;
