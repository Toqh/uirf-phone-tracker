begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users(id, aud, role, email, raw_user_meta_data)
values ('12000000-0000-0000-0000-000000000001','authenticated','authenticated','signup-enumerator@example.test','{"full_name":"Enumerator Signup","role":"enumerator"}'),
       ('12000000-0000-0000-0000-000000000002','authenticated','authenticated','signup-supervisor@example.test','{"full_name":"Supervisor Signup","role":"supervisor"}'),
       ('12000000-0000-0000-0000-000000000003','authenticated','authenticated','signup-admin@example.test','{"role":"admin","status":"approved"}'),
       ('12000000-0000-0000-0000-000000000004','authenticated','authenticated','signup-legacy@example.test','{}');

select is((select role::text from public.profiles where id = '12000000-0000-0000-0000-000000000001'), 'enumerator', 'Enumerator choice is persisted');
select is((select role::text from public.profiles where id = '12000000-0000-0000-0000-000000000002'), 'supervisor', 'Supervisor choice is persisted');
select is((select role::text from public.profiles where id = '12000000-0000-0000-0000-000000000003'), 'supervisor', 'Metadata cannot grant Admin');
select is((select role::text from public.profiles where id = '12000000-0000-0000-0000-000000000004'), 'supervisor', 'Older signup clients retain default role');
select is((select count(*)::integer from public.profiles where id::text like '12000000-%' and status = 'approved'), 4, 'All viewing signups are automatically enabled');
select ok((select bool_and(approved_at is not null and approved_by is null) from public.profiles where id::text like '12000000-%'), 'Automatic access records time without claiming an Admin approved it');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(public.is_approved_user(), true, 'Enumerator has immediate viewing access');
select throws_ok($$select public.promote_to_admin('12000000-0000-0000-0000-000000000001')$$, '42501', 'Not authorised: an approved Admin is required', 'Enumerator cannot self-promote');
select throws_ok($$select public.add_phone('008')$$, '42501', 'Not authorised: an approved Admin is required', 'Enumerator cannot write phone records');

select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(public.is_approved_user(), true, 'Supervisor has immediate viewing access');
select throws_ok($$select public.approve_account('12000000-0000-0000-0000-000000000003')$$, '42501', 'Not authorised: an approved Admin is required', 'Supervisor cannot approve other accounts');

reset role;
update public.profiles set status = 'disabled' where id = '12000000-0000-0000-0000-000000000001';
update auth.users set raw_user_meta_data = '{"role":"supervisor","status":"approved"}' where id = '12000000-0000-0000-0000-000000000001';
select is((select status::text from public.profiles where id = '12000000-0000-0000-0000-000000000001'), 'disabled', 'Updating signup metadata cannot reactivate a disabled account');
select is((select role::text from public.profiles where id = '12000000-0000-0000-0000-000000000001'), 'enumerator', 'Updating signup metadata cannot change an existing account role');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(public.is_approved_user(), false, 'Disabled Enumerator remains blocked');

select * from finish();
rollback;
