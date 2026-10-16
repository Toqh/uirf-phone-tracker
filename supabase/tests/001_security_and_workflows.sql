begin;
create extension if not exists pgtap with schema extensions;
select plan(49);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@example.test', crypt('test-password', gen_salt('bf')), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Admin"}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'supervisor@example.test', crypt('test-password', gen_salt('bf')), '{"provider":"email","providers":["email"]}', '{"full_name":"Read Only"}', now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'pending@example.test', crypt('test-password', gen_salt('bf')), '{"provider":"email","providers":["email"]}', '{"full_name":"Pending User","role":"admin","status":"approved"}', now(), now());

select is((select role::text from public.profiles where id = '10000000-0000-0000-0000-000000000003'), 'supervisor', 'signup metadata cannot set Admin role');
select is((select status::text from public.profiles where id = '10000000-0000-0000-0000-000000000003'), 'approved', 'new account receives viewing access only');

-- Keep an explicit pending fixture to verify that the database still enforces account status.
update public.profiles set status = 'pending', approved_at = null, approved_by = null where id = '10000000-0000-0000-0000-000000000003';

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
select throws_ok($$select public.issue_phone('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','DASH','20000000-0000-0000-0000-000000000001')$$, 'P0001', 'Phone is not configured', 'unconfigured phone cannot be issued');
select lives_ok($$select public.configure_phone('40000000-0000-0000-0000-000000000001',true,true,true,true,null)$$, 'Admin can complete readiness checklist');
select is((select status::text from public.phones where id = '40000000-0000-0000-0000-000000000001'), 'available', 'configured phone becomes available');
select lives_ok($$select public.issue_phone('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','DASH','20000000-0000-0000-0000-000000000001')$$, 'available phone can be issued');
select is((select count(*) from public.checkouts where phone_id = '40000000-0000-0000-0000-000000000001' and returned_at is null), 1::bigint, 'only one active checkout exists');
select throws_ok($$select public.reset_phone_checklist('40000000-0000-0000-0000-000000000001','Wrong checklist')$$, 'P0001', 'Only available phones with a completed checklist can be reset', 'issued phone checklist cannot be reset');
select throws_ok($$select public.issue_phone('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','DASH','20000000-0000-0000-0000-000000000001')$$, 'P0001', 'Phone is not available', 'already-issued phone cannot be issued again');
select lives_ok($$select public.return_phone((select id from public.checkouts where phone_id = '40000000-0000-0000-0000-000000000001' and returned_at is null),false,null)$$, 'return closes the active checkout');
select is((select returned_by::text from public.checkouts where phone_id = '40000000-0000-0000-0000-000000000001'), '10000000-0000-0000-0000-000000000001', 'return records receiving Admin');
select is((select serial_number from public.phones where id = '40000000-0000-0000-0000-000000000001'), '007', 'leading zero remains stored');

select throws_ok($$select public.reset_phone_checklist('40000000-0000-0000-0000-000000000001','')$$, 'P0001', 'A reason of at least five characters is required', 'checklist reset requires a reason');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.reset_phone_checklist('40000000-0000-0000-0000-000000000001','Wrong checklist')$$, '42501', 'Not authorised: an approved Admin is required', 'Supervisor cannot reset readiness');
select throws_ok($$select public.set_directory_active('enumerator','30000000-0000-0000-0000-000000000001',false)$$, '42501', 'Not authorised: an approved Admin is required', 'Supervisor cannot change directory state');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.reset_phone_checklist('40000000-0000-0000-0000-000000000001','Marked complete by mistake')$$, 'Admin can reset an available phone');
select is((select status::text from public.phones where id = '40000000-0000-0000-0000-000000000001'), 'awaiting_configuration', 'reset returns to checklist due');
select ok((select configured_at is null and not survey_app_installed and not correct_form_loaded and not login_sync_tested and not device_checked from public.phone_register where id = '40000000-0000-0000-0000-000000000001'), 'view does not expose old checklist as current readiness');
select is((select count(*) from public.configuration_records where phone_id = '40000000-0000-0000-0000-000000000001'), 1::bigint, 'reset retains historical completed checklist');
select is((select details->>'reason' from public.audit_events where phone_id = '40000000-0000-0000-0000-000000000001' and event_type = 'phone.checklist_reset'), 'Marked complete by mistake', 'reset reason recorded in audit trail');
select throws_ok($$select public.reset_phone_checklist('40000000-0000-0000-0000-000000000001','Reset again')$$, 'P0001', 'Only available phones with a completed checklist can be reset', 'an already incomplete checklist cannot be reset');
select throws_ok($$select public.issue_phone('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','DASH',null)$$, 'P0001', 'Phone is not configured', 'reset phone cannot be issued before completing checklist');
select lives_ok($$select public.configure_phone('40000000-0000-0000-0000-000000000001',true,true,true,true,null)$$, 'checklist can be completed again');
select is((select count(*) from public.configuration_records where phone_id = '40000000-0000-0000-0000-000000000001'), 2::bigint, 'completing again adds history');
select lives_ok($$select public.set_directory_active('enumerator','30000000-0000-0000-0000-000000000001',false)$$, 'Admin can deactivate an enumerator');
select is((select active from public.enumerators where id = '30000000-0000-0000-0000-000000000001'), false, 'directory entry becomes inactive');
select lives_ok($$select public.set_directory_active('enumerator','30000000-0000-0000-0000-000000000001',true)$$, 'Admin can reactivate an enumerator');
select is((select active from public.enumerators where id = '30000000-0000-0000-0000-000000000001'), true, 'directory entry becomes active again');

select throws_ok($$select public.issue_phone('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',null)$$, 'P0001', 'Select DASH or NUTRINT', 'project is required');
select throws_ok($$select public.issue_phone('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','OTHER')$$, 'P0001', 'Select DASH or NUTRINT', 'invalid project rejected');
select lives_ok($$select public.issue_phone('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','NUTRINT')$$, 'can issue without supervisor');
select ok((select supervisor_id is null and project = 'NUTRINT' from public.checkouts where phone_id = '40000000-0000-0000-0000-000000000001' and returned_at is null), 'checkout stores project and no supervisor');
select is((select project from public.phone_register where id = '40000000-0000-0000-0000-000000000001'), 'NUTRINT', 'register exposes project');
select is((select project from public.movement_history where phone_id = '40000000-0000-0000-0000-000000000001' and returned_at is not null), 'DASH', 'previous project survives return and reissue');
select is((select details->>'project' from public.audit_events where entity_id = (select active_checkout_id from public.phone_register where id = '40000000-0000-0000-0000-000000000001') and event_type = 'phone.issued'), 'NUTRINT', 'project recorded in audit');
select lives_ok($$select public.return_phone((select active_checkout_id from public.phone_register where id = '40000000-0000-0000-0000-000000000001'),false,null)$$, 'return enumerator checkout before supervisor issue');
select throws_ok($$select public.issue_phone('40000000-0000-0000-0000-000000000001',null,'DASH',null)$$, 'P0001', 'Select an enumerator or supervisor', 'empty recipient rejected');
select public.set_directory_active('supervisor','20000000-0000-0000-0000-000000000001',false);
select throws_ok($$select public.issue_phone('40000000-0000-0000-0000-000000000001',null,'DASH','20000000-0000-0000-0000-000000000001')$$, 'P0001', 'Select an active supervisor', 'inactive supervisor rejected');
select public.set_directory_active('supervisor','20000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.issue_phone('40000000-0000-0000-0000-000000000001',null,'DASH','20000000-0000-0000-0000-000000000001')$$, 'phone can be issued directly to a supervisor');
select ok((select enumerator_id is null and supervisor_id = '20000000-0000-0000-0000-000000000001' and project = 'DASH' from public.phone_register where id = '40000000-0000-0000-0000-000000000001'), 'register preserves direct supervisor and project');
select throws_ok($$select public.issue_phone('40000000-0000-0000-0000-000000000001',null,'DASH','20000000-0000-0000-0000-000000000001')$$, 'P0001', 'Phone is not available', 'duplicate supervisor issue rejected');
select lives_ok($$select public.correct_checkout((select active_checkout_id from public.phone_register where id = '40000000-0000-0000-0000-000000000001'),null,'20000000-0000-0000-0000-000000000001','Confirm supervisor holder')$$, 'correction supports supervisor-only holder');
select lives_ok($$select public.return_phone((select active_checkout_id from public.phone_register where id = '40000000-0000-0000-0000-000000000001'),false,null)$$, 'supervisor checkout can be returned');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.issue_phone('40000000-0000-0000-0000-000000000001',null,'DASH','20000000-0000-0000-0000-000000000001')$$, '42501', 'Not authorised: an approved Admin is required', 'Supervisor account cannot issue phones');

select * from finish();
rollback;
