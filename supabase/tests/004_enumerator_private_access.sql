begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users(id, aud, role, email, raw_user_meta_data) values
('13000000-0000-0000-0000-000000000001','authenticated','authenticated','private-admin@example.test','{"full_name":"Admin"}'),
('13000000-0000-0000-0000-000000000002','authenticated','authenticated','private-supervisor@example.test','{"full_name":"Supervisor","role":"supervisor"}'),
('13000000-0000-0000-0000-000000000003','authenticated','authenticated','private-enumerator@example.test','{"full_name":"First Enumerator","role":"enumerator"}'),
('13000000-0000-0000-0000-000000000004','authenticated','authenticated','private-other@example.test','{"full_name":"Second Enumerator","role":"enumerator"}'),
('13000000-0000-0000-0000-000000000005','authenticated','authenticated','private-unlinked@example.test','{"full_name":"Unlinked Enumerator","role":"enumerator"}');
update public.profiles set role = 'admin' where id = '13000000-0000-0000-0000-000000000001';
insert into public.supervisors(id, supervisor_code, full_name, created_by, updated_by)
values ('33000000-0000-0000-0000-000000000001','PRIVATE-SUP','Supervisor','13000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001');
insert into public.enumerators(id, enumerator_code, full_name, linked_profile_id, created_by, updated_by) values
('23000000-0000-0000-0000-000000000001','PRIVATE-E1','First Enumerator','13000000-0000-0000-0000-000000000003','13000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001'),
('23000000-0000-0000-0000-000000000002','PRIVATE-E2','Second Enumerator','13000000-0000-0000-0000-000000000004','13000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001');
insert into public.phones(id, serial_number, status, configured_at, configured_by, created_by) values
('43000000-0000-0000-0000-000000000001','901','issued',now(),'13000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001'),
('43000000-0000-0000-0000-000000000002','902','issued',now(),'13000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001'),
('43000000-0000-0000-0000-000000000003','903','available',now(),'13000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001'),
('43000000-0000-0000-0000-000000000004','904','available',now(),'13000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001');
insert into public.configuration_records(phone_id, survey_app_installed, correct_form_loaded, login_sync_tested, device_checked, recorded_by)
select id, true, true, true, true, '13000000-0000-0000-0000-000000000001' from public.phones where id::text like '43000000-%';
insert into public.checkouts(id, phone_id, enumerator_id, enumerator_code_snapshot, enumerator_name_snapshot, issued_by, project) values
('53000000-0000-0000-0000-000000000001','43000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000001','PRIVATE-E1','First Enumerator','13000000-0000-0000-0000-000000000001','DASH'),
('53000000-0000-0000-0000-000000000002','43000000-0000-0000-0000-000000000002','23000000-0000-0000-0000-000000000002','PRIVATE-E2','Second Enumerator','13000000-0000-0000-0000-000000000001','DASH');
insert into public.checkouts(id, phone_id, enumerator_id, enumerator_code_snapshot, enumerator_name_snapshot, issued_by, project, collected_at, returned_at, returned_by, return_condition) values
('53000000-0000-0000-0000-000000000003','43000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000002','PRIVATE-E2','Previous Holder','13000000-0000-0000-0000-000000000001','DASH',now()-interval '2 days',now()-interval '1 day','13000000-0000-0000-0000-000000000001','good'),
('53000000-0000-0000-0000-000000000004','43000000-0000-0000-0000-000000000003','23000000-0000-0000-0000-000000000001','PRIVATE-E1','First Enumerator','13000000-0000-0000-0000-000000000001','DASH',now()-interval '2 days',now()-interval '1 day','13000000-0000-0000-0000-000000000001','good');
insert into public.faults(phone_id, notes, reported_by) values ('43000000-0000-0000-0000-000000000001','Historical fault','13000000-0000-0000-0000-000000000001');
insert into public.transaction_corrections(checkout_id, reason, previous_values, corrected_values, recorded_by) values ('53000000-0000-0000-0000-000000000003','Correct previous holder','{}','{}','13000000-0000-0000-0000-000000000001');
insert into public.audit_events(event_type, entity_type, phone_id, actor_id) values ('phone.test','phone','43000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"13000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is(public.can_view_register(), false, 'Enumerator has no register access');
select is(public.current_enumerator_id()::text, '23000000-0000-0000-0000-000000000001', 'Identity uses the account link');
select results_eq('select serial_number from public.phones order by serial_number', array['901'::text], 'Base table shows only currently held phone');
select results_eq('select serial_number from public.phone_register order by serial_number', array['901'::text], 'Register view preserves current assignment despite hidden staff profiles');
select results_eq('select id::text from public.checkouts', array['53000000-0000-0000-0000-000000000001'::text], 'No previous-holder or returned checkout exposure');
select is((select count(*) from public.profiles), 1::bigint, 'Only own profile is readable');
select is((select count(*) from public.enumerators), 1::bigint, 'Only own directory entry is readable');
select is((select count(*) from public.supervisors), 0::bigint, 'Supervisor directory is hidden');
select is((select count(*) from public.configuration_records), 0::bigint, 'Configuration history is hidden');
select is((select count(*) from public.faults), 0::bigint, 'Fault history is hidden');
select is((select count(*) from public.transaction_corrections), 0::bigint, 'Corrections are hidden');
select is((select count(*) from public.audit_events), 0::bigint, 'Audit history is hidden');
select is((select count(*) from public.movement_history), 0::bigint, 'Report view is hidden');
select is(public.enumerator_holds_phone('43000000-0000-0000-0000-000000000002'), false, 'Cannot use helper to access another holder');
select throws_ok($$select public.add_phone('905')$$, '42501', 'Not authorised: an approved Admin is required', 'Enumerator cannot manage phones');

select set_config('request.jwt.claims', '{"sub":"13000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select results_eq('select serial_number from public.phone_register', array['902'::text], 'Other enumerator sees their own current phone only');
select set_config('request.jwt.claims', '{"sub":"13000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select is((select count(*) from public.phones), 0::bigint, 'Unlinked enumerator sees no phones');
select set_config('request.jwt.claims', '{"sub":"13000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*) from public.phone_register where id::text like '43000000-%'), 4::bigint, 'Admin retains full register');
select is((select count(*) from public.movement_history where phone_id::text like '43000000-%'), 4::bigint, 'Admin retains full history');
select set_config('request.jwt.claims', '{"sub":"13000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*) from public.phone_register where id::text like '43000000-%'), 4::bigint, 'Supervisor retains full register');
select is((select count(*) from public.movement_history where phone_id::text like '43000000-%'), 4::bigint, 'Supervisor retains reports');

select set_config('request.jwt.claims', '{"sub":"13000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.return_phone('53000000-0000-0000-0000-000000000001',false,null);
select set_config('request.jwt.claims', '{"sub":"13000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*) from public.phone_register), 0::bigint, 'Returned phone immediately disappears');
select set_config('request.jwt.claims', '{"sub":"13000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.issue_phone('43000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000002','DASH');
select set_config('request.jwt.claims', '{"sub":"13000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*) from public.phones), 0::bigint, 'Previous holder cannot see the reissued phone');
reset role;
update public.profiles set status = 'disabled' where id = '13000000-0000-0000-0000-000000000004';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"13000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select is((select count(*) from public.phones), 0::bigint, 'Disabled holder cannot read phones');
select is((select count(*) from public.checkouts), 0::bigint, 'Disabled holder cannot read checkouts');
reset role;
update public.profiles set status = 'approved' where id = '13000000-0000-0000-0000-000000000004';
update public.enumerators set linked_profile_id = null where id = '23000000-0000-0000-0000-000000000002';
set local role authenticated;
select is((select count(*) from public.phones), 0::bigint, 'Unlinking account revokes phone visibility');
select is((select count(*) from public.enumerators), 0::bigint, 'Unlinking account revokes directory visibility');
select * from finish();
rollback;
