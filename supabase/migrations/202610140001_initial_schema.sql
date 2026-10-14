-- Survey Phone Tracker: schema, permissions, atomic operations, and audit trail.
-- Run with the Supabase CLI (`supabase db push`) or paste into the SQL editor.

create extension if not exists pgcrypto;

create type public.account_role as enum ('admin', 'supervisor');
create type public.account_status as enum ('pending', 'approved', 'disabled');
create type public.phone_status as enum ('awaiting_configuration', 'available', 'issued', 'needs_attention');
create type public.return_condition as enum ('good', 'faulty');
create type public.import_kind as enum ('phones', 'supervisors', 'enumerators');
create type public.import_row_status as enum ('imported', 'skipped', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) between 2 and 150),
  email text not null,
  role public.account_role not null default 'supervisor',
  status public.account_status not null default 'pending',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint approval_fields_match_status check (
    (status = 'pending' and approved_at is null and approved_by is null)
    or (status in ('approved', 'disabled'))
  )
);

create table public.supervisors (
  id uuid primary key default gen_random_uuid(),
  supervisor_code text not null,
  full_name text not null check (length(btrim(full_name)) between 2 and 150),
  email text,
  active boolean not null default true,
  linked_profile_id uuid unique references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict
);
create unique index supervisors_code_unique on public.supervisors (lower(supervisor_code));

create table public.enumerators (
  id uuid primary key default gen_random_uuid(),
  enumerator_code text not null,
  full_name text not null check (length(btrim(full_name)) between 2 and 150),
  usual_supervisor_id uuid references public.supervisors(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict
);
create unique index enumerators_code_unique on public.enumerators (lower(enumerator_code));

create table public.phones (
  id uuid primary key default gen_random_uuid(),
  serial_number text not null unique check (serial_number ~ '^[0-9]{3}$'),
  status public.phone_status not null default 'awaiting_configuration',
  configured_at timestamptz,
  configured_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint configuration_identity_complete check ((configured_at is null) = (configured_by is null)),
  constraint available_or_issued_is_configured check (status not in ('available', 'issued') or configured_at is not null)
);

create table public.configuration_records (
  id uuid primary key default gen_random_uuid(),
  phone_id uuid not null references public.phones(id) on delete restrict,
  survey_app_installed boolean not null,
  correct_form_loaded boolean not null,
  login_sync_tested boolean not null,
  device_checked boolean not null,
  resolution_notes text,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  constraint all_readiness_checks_complete check (survey_app_installed and correct_form_loaded and login_sync_tested and device_checked)
);

create table public.checkouts (
  id uuid primary key default gen_random_uuid(),
  phone_id uuid not null references public.phones(id) on delete restrict,
  enumerator_id uuid not null references public.enumerators(id) on delete restrict,
  enumerator_code_snapshot text not null,
  enumerator_name_snapshot text not null,
  supervisor_id uuid references public.supervisors(id) on delete restrict,
  supervisor_code_snapshot text,
  supervisor_name_snapshot text,
  collected_at timestamptz not null default now(),
  issued_by uuid not null references public.profiles(id) on delete restrict,
  returned_at timestamptz,
  returned_by uuid references public.profiles(id) on delete restrict,
  return_condition public.return_condition,
  fault_notes text,
  constraint return_fields_consistent check (
    (returned_at is null and returned_by is null and return_condition is null)
    or (returned_at is not null and returned_by is not null and return_condition is not null)
  ),
  constraint faulty_return_has_notes check (return_condition <> 'faulty' or length(btrim(fault_notes)) > 0),
  constraint return_after_collection check (returned_at is null or returned_at >= collected_at)
);
create unique index one_open_checkout_per_phone on public.checkouts(phone_id) where returned_at is null;
create index checkouts_phone_period on public.checkouts(phone_id, collected_at desc);

create table public.faults (
  id uuid primary key default gen_random_uuid(),
  phone_id uuid not null references public.phones(id) on delete restrict,
  checkout_id uuid references public.checkouts(id) on delete restrict,
  notes text not null check (length(btrim(notes)) > 0),
  reported_at timestamptz not null default now(),
  reported_by uuid not null references public.profiles(id) on delete restrict,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete restrict,
  resolution_notes text,
  constraint fault_resolution_complete check ((resolved_at is null and resolved_by is null) or (resolved_at is not null and resolved_by is not null and length(btrim(resolution_notes)) > 0))
);

create table public.transaction_corrections (
  id uuid primary key default gen_random_uuid(),
  checkout_id uuid not null references public.checkouts(id) on delete restrict,
  reason text not null check (length(btrim(reason)) >= 5),
  previous_values jsonb not null,
  corrected_values jsonb not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles(id) on delete restrict
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  kind public.import_kind not null,
  file_name text not null,
  total_rows integer not null check (total_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  skipped_rows integer not null default 0 check (skipped_rows >= 0),
  failed_rows integer not null default 0 check (failed_rows >= 0),
  imported_at timestamptz not null default now(),
  imported_by uuid not null references public.profiles(id) on delete restrict
);

create table public.import_results (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.import_batches(id) on delete restrict,
  row_number integer not null check (row_number > 1),
  status public.import_row_status not null,
  source_data jsonb not null,
  error_message text
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  phone_id uuid references public.phones(id) on delete restrict,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  actor_id uuid not null references public.profiles(id) on delete restrict
);
create index audit_events_phone_time on public.audit_events(phone_id, occurred_at desc);

-- Signup metadata supplies a name only. Role and approval are fixed here and cannot be set by the client.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles (id, full_name, email, role, status)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'New user'), '@', 1)),
    coalesce(new.email, ''),
    'supervisor',
    'pending'
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_approved_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and status = 'approved');
$$;
create or replace function public.is_admin_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and status = 'approved' and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.supervisors enable row level security;
alter table public.enumerators enable row level security;
alter table public.phones enable row level security;
alter table public.configuration_records enable row level security;
alter table public.checkouts enable row level security;
alter table public.faults enable row level security;
alter table public.transaction_corrections enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_results enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_read_self_or_approved_or_admin on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin_user() or (public.is_approved_user() and status = 'approved'));
create policy approved_read_supervisors on public.supervisors for select to authenticated using (public.is_approved_user());
create policy approved_read_enumerators on public.enumerators for select to authenticated using (public.is_approved_user());
create policy approved_read_phones on public.phones for select to authenticated using (public.is_approved_user());
create policy approved_read_configuration on public.configuration_records for select to authenticated using (public.is_approved_user());
create policy approved_read_checkouts on public.checkouts for select to authenticated using (public.is_approved_user());
create policy approved_read_faults on public.faults for select to authenticated using (public.is_approved_user());
create policy approved_read_corrections on public.transaction_corrections for select to authenticated using (public.is_approved_user());
create policy admin_read_import_batches on public.import_batches for select to authenticated using (public.is_admin_user());
create policy admin_read_import_results on public.import_results for select to authenticated using (public.is_admin_user());
create policy approved_read_audit on public.audit_events for select to authenticated using (public.is_approved_user());

-- Restrict the Data API to reads. All writes use the checked functions below.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.supervisors, public.enumerators, public.phones,
  public.configuration_records, public.checkouts, public.faults, public.transaction_corrections,
  public.import_batches, public.import_results, public.audit_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create or replace function public.require_admin()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not public.is_admin_user() then raise exception 'Not authorised: an approved Admin is required' using errcode = '42501'; end if;
  return actor;
end;
$$;

create or replace function public.add_phone(p_serial_number text)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin(); new_id uuid; serial text := btrim(p_serial_number);
begin
  if serial !~ '^[0-9]{3}$' then raise exception 'Phone serial must be exactly three digits'; end if;
  insert into public.phones(serial_number, created_by) values(serial, actor) returning id into new_id;
  insert into public.audit_events(event_type, entity_type, entity_id, phone_id, actor_id, details) values('phone.registered', 'phone', new_id, new_id, actor, jsonb_build_object('serial_number', serial));
  return new_id;
exception when unique_violation then raise exception 'Phone serial % already exists', serial;
end;
$$;

create or replace function public.configure_phone(
  p_phone_id uuid, p_survey_app_installed boolean, p_correct_form_loaded boolean,
  p_login_sync_tested boolean, p_device_checked boolean, p_resolution_notes text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin(); phone_record public.phones%rowtype; record_id uuid; event_name text;
begin
  select * into phone_record from public.phones where id = p_phone_id for update;
  if not found then raise exception 'Phone not found'; end if;
  if phone_record.status not in ('awaiting_configuration', 'needs_attention') then raise exception 'Phone does not need a readiness checklist'; end if;
  if not (p_survey_app_installed and p_correct_form_loaded and p_login_sync_tested and p_device_checked) then raise exception 'Every readiness check must be confirmed'; end if;
  if phone_record.status = 'needs_attention' and coalesce(length(btrim(p_resolution_notes)), 0) < 3 then raise exception 'Resolution notes are required'; end if;
  event_name := case when phone_record.status = 'needs_attention' then 'fault.resolved' else 'phone.configured' end;
  insert into public.configuration_records(phone_id, survey_app_installed, correct_form_loaded, login_sync_tested, device_checked, resolution_notes, recorded_by)
  values(p_phone_id, true, true, true, true, nullif(btrim(p_resolution_notes), ''), actor) returning id into record_id;
  update public.phones set status = 'available', configured_at = coalesce(configured_at, now()), configured_by = coalesce(configured_by, actor), updated_at = now() where id = p_phone_id;
  if phone_record.status = 'needs_attention' then
    update public.faults set resolved_at = now(), resolved_by = actor, resolution_notes = btrim(p_resolution_notes) where phone_id = p_phone_id and resolved_at is null;
  end if;
  insert into public.audit_events(event_type, entity_type, entity_id, phone_id, actor_id, details) values(event_name, 'configuration_record', record_id, p_phone_id, actor, jsonb_build_object('resolution_notes', p_resolution_notes));
  return record_id;
end;
$$;

create or replace function public.issue_phone(p_phone_id uuid, p_enumerator_id uuid, p_supervisor_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin(); phone_record public.phones%rowtype; enumerator_record public.enumerators%rowtype; supervisor_record public.supervisors%rowtype; checkout_id uuid;
begin
  select * into phone_record from public.phones where id = p_phone_id for update;
  if not found then raise exception 'Phone not found'; end if;
  if phone_record.configured_at is null then raise exception 'Phone is not configured'; end if;
  if phone_record.status <> 'available' then raise exception 'Phone is not available'; end if;
  select * into enumerator_record from public.enumerators where id = p_enumerator_id and active;
  if not found then raise exception 'Select an active enumerator'; end if;
  if p_supervisor_id is not null then
    select * into supervisor_record from public.supervisors where id = p_supervisor_id and active;
    if not found then raise exception 'Select an active supervisor'; end if;
  end if;
  insert into public.checkouts(phone_id, enumerator_id, enumerator_code_snapshot, enumerator_name_snapshot, supervisor_id, supervisor_code_snapshot, supervisor_name_snapshot, issued_by)
  values(p_phone_id, p_enumerator_id, enumerator_record.enumerator_code, enumerator_record.full_name, p_supervisor_id, supervisor_record.supervisor_code, supervisor_record.full_name, actor)
  returning id into checkout_id;
  update public.phones set status = 'issued', updated_at = now() where id = p_phone_id;
  insert into public.audit_events(event_type, entity_type, entity_id, phone_id, actor_id, details)
  values('phone.issued', 'checkout', checkout_id, p_phone_id, actor, jsonb_build_object('enumerator_id', p_enumerator_id, 'enumerator_name', enumerator_record.full_name, 'supervisor_id', p_supervisor_id, 'supervisor_name', supervisor_record.full_name));
  return checkout_id;
exception when unique_violation then raise exception 'Phone is already issued';
end;
$$;

create or replace function public.return_phone(p_checkout_id uuid, p_faulty boolean default false, p_fault_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin(); checkout_record public.checkouts%rowtype; fault_id uuid;
begin
  select * into checkout_record from public.checkouts where id = p_checkout_id for update;
  if not found then raise exception 'Checkout not found'; end if;
  if checkout_record.returned_at is not null then raise exception 'Phone was already returned'; end if;
  perform 1 from public.phones where id = checkout_record.phone_id for update;
  if p_faulty and coalesce(length(btrim(p_fault_notes)), 0) < 3 then raise exception 'Fault details are required'; end if;
  update public.checkouts set returned_at = now(), returned_by = actor, return_condition = case when p_faulty then 'faulty'::public.return_condition else 'good'::public.return_condition end, fault_notes = case when p_faulty then btrim(p_fault_notes) else null end where id = p_checkout_id;
  update public.phones set status = case when p_faulty then 'needs_attention'::public.phone_status else 'available'::public.phone_status end, updated_at = now() where id = checkout_record.phone_id;
  if p_faulty then
    insert into public.faults(phone_id, checkout_id, notes, reported_by) values(checkout_record.phone_id, p_checkout_id, btrim(p_fault_notes), actor) returning id into fault_id;
  end if;
  insert into public.audit_events(event_type, entity_type, entity_id, phone_id, actor_id, details)
  values('phone.returned', 'checkout', p_checkout_id, checkout_record.phone_id, actor, jsonb_build_object('condition', case when p_faulty then 'faulty' else 'good' end, 'fault_id', fault_id, 'fault_notes', p_fault_notes));
  return p_checkout_id;
end;
$$;

create or replace function public.save_supervisor(p_id uuid, p_code text, p_full_name text, p_email text default null, p_active boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin(); result_id uuid; code text := upper(btrim(p_code));
begin
  if length(btrim(p_full_name)) < 2 then raise exception 'Full name is required'; end if;
  if code = '' then code := 'SUP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)); end if;
  if p_id is null then insert into public.supervisors(supervisor_code, full_name, email, active, created_by, updated_by) values(code, btrim(p_full_name), nullif(btrim(p_email), ''), p_active, actor, actor) returning id into result_id;
  else update public.supervisors set supervisor_code = code, full_name = btrim(p_full_name), email = nullif(btrim(p_email), ''), active = p_active, updated_at = now(), updated_by = actor where id = p_id returning id into result_id; end if;
  insert into public.audit_events(event_type, entity_type, entity_id, actor_id, details) values(case when p_id is null then 'supervisor.created' else 'supervisor.updated' end, 'supervisor', result_id, actor, jsonb_build_object('code', code, 'full_name', btrim(p_full_name), 'active', p_active));
  return result_id;
exception when unique_violation then raise exception 'Supervisor code % already exists', code;
end;
$$;

create or replace function public.save_enumerator(p_id uuid, p_code text, p_full_name text, p_supervisor_id uuid default null, p_active boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin(); result_id uuid; code text := upper(btrim(p_code));
begin
  if length(btrim(p_full_name)) < 2 then raise exception 'Full name is required'; end if;
  if code = '' then code := 'ENU-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)); end if;
  if p_supervisor_id is not null and not exists(select 1 from public.supervisors where id = p_supervisor_id) then raise exception 'Supervisor not found'; end if;
  if p_id is null then insert into public.enumerators(enumerator_code, full_name, usual_supervisor_id, active, created_by, updated_by) values(code, btrim(p_full_name), p_supervisor_id, p_active, actor, actor) returning id into result_id;
  else update public.enumerators set enumerator_code = code, full_name = btrim(p_full_name), usual_supervisor_id = p_supervisor_id, active = p_active, updated_at = now(), updated_by = actor where id = p_id returning id into result_id; end if;
  insert into public.audit_events(event_type, entity_type, entity_id, actor_id, details) values(case when p_id is null then 'enumerator.created' else 'enumerator.updated' end, 'enumerator', result_id, actor, jsonb_build_object('code', code, 'full_name', btrim(p_full_name), 'active', p_active, 'usual_supervisor_id', p_supervisor_id));
  return result_id;
exception when unique_violation then raise exception 'Enumerator code % already exists', code;
end;
$$;

create or replace function public.approve_account(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin();
begin
  if p_profile_id = actor then raise exception 'An Admin cannot approve their own account'; end if;
  update public.profiles set status = 'approved', approved_at = now(), approved_by = actor, updated_at = now() where id = p_profile_id and status = 'pending';
  if not found then raise exception 'Pending account not found'; end if;
  insert into public.audit_events(event_type, entity_type, entity_id, actor_id) values('account.approved', 'profile', p_profile_id, actor);
end;
$$;

create or replace function public.set_account_enabled(p_profile_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin();
begin
  if p_profile_id = actor and not p_enabled then raise exception 'You cannot disable your own account'; end if;
  update public.profiles set status = case when p_enabled then 'approved'::public.account_status else 'disabled'::public.account_status end, approved_at = coalesce(approved_at, now()), approved_by = coalesce(approved_by, actor), updated_at = now() where id = p_profile_id and status <> 'pending';
  if not found then raise exception 'Account not found or still pending'; end if;
  insert into public.audit_events(event_type, entity_type, entity_id, actor_id, details) values(case when p_enabled then 'account.enabled' else 'account.disabled' end, 'profile', p_profile_id, actor, jsonb_build_object('enabled', p_enabled));
end;
$$;

create or replace function public.promote_to_admin(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin();
begin
  if p_profile_id = actor then raise exception 'You cannot promote yourself'; end if;
  update public.profiles set role = 'admin', updated_at = now() where id = p_profile_id and status = 'approved' and role = 'supervisor';
  if not found then raise exception 'Approved Supervisor account not found'; end if;
  insert into public.audit_events(event_type, entity_type, entity_id, actor_id) values('account.promoted', 'profile', p_profile_id, actor);
end;
$$;

create or replace function public.link_supervisor_account(p_supervisor_id uuid, p_profile_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin();
begin
  if p_profile_id is not null and not exists(select 1 from public.profiles where id = p_profile_id and status = 'approved') then raise exception 'Only an approved account can be linked'; end if;
  update public.supervisors set linked_profile_id = p_profile_id, updated_at = now(), updated_by = actor where id = p_supervisor_id;
  if not found then raise exception 'Supervisor directory entry not found'; end if;
  insert into public.audit_events(event_type, entity_type, entity_id, actor_id, details) values('supervisor.account_linked', 'supervisor', p_supervisor_id, actor, jsonb_build_object('profile_id', p_profile_id));
end;
$$;

create or replace function public.correct_checkout(p_checkout_id uuid, p_enumerator_id uuid, p_supervisor_id uuid default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin(); old_record public.checkouts%rowtype; enum_record public.enumerators%rowtype; sup_record public.supervisors%rowtype; old_json jsonb; new_json jsonb;
begin
  if coalesce(length(btrim(p_reason)), 0) < 5 then raise exception 'A correction reason of at least five characters is required'; end if;
  select * into old_record from public.checkouts where id = p_checkout_id for update;
  if not found then raise exception 'Checkout not found'; end if;
  select * into enum_record from public.enumerators where id = p_enumerator_id;
  if not found then raise exception 'Enumerator not found'; end if;
  if p_supervisor_id is not null then select * into sup_record from public.supervisors where id = p_supervisor_id; if not found then raise exception 'Supervisor not found'; end if; end if;
  old_json := jsonb_build_object('enumerator_id', old_record.enumerator_id, 'enumerator_code', old_record.enumerator_code_snapshot, 'enumerator_name', old_record.enumerator_name_snapshot, 'supervisor_id', old_record.supervisor_id, 'supervisor_code', old_record.supervisor_code_snapshot, 'supervisor_name', old_record.supervisor_name_snapshot);
  new_json := jsonb_build_object('enumerator_id', enum_record.id, 'enumerator_code', enum_record.enumerator_code, 'enumerator_name', enum_record.full_name, 'supervisor_id', sup_record.id, 'supervisor_code', sup_record.supervisor_code, 'supervisor_name', sup_record.full_name);
  update public.checkouts set enumerator_id = enum_record.id, enumerator_code_snapshot = enum_record.enumerator_code, enumerator_name_snapshot = enum_record.full_name, supervisor_id = sup_record.id, supervisor_code_snapshot = sup_record.supervisor_code, supervisor_name_snapshot = sup_record.full_name where id = p_checkout_id;
  insert into public.transaction_corrections(checkout_id, reason, previous_values, corrected_values, recorded_by) values(p_checkout_id, btrim(p_reason), old_json, new_json, actor);
  insert into public.audit_events(event_type, entity_type, entity_id, phone_id, actor_id, details) values('checkout.corrected', 'checkout', p_checkout_id, old_record.phone_id, actor, jsonb_build_object('reason', btrim(p_reason), 'previous', old_json, 'corrected', new_json));
end;
$$;

create or replace function public.process_import(p_kind public.import_kind, p_file_name text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin(); batch_id uuid; item jsonb; row_index int := 0; imported int := 0; skipped int := 0; failed int := 0; row_status public.import_row_status; error_text text; code text; name text; serial text; email_value text; supervisor_id uuid; entity_id uuid; errors jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Import rows must be an array'; end if;
  insert into public.import_batches(kind, file_name, total_rows, imported_by) values(p_kind, coalesce(nullif(btrim(p_file_name), ''), 'upload.csv'), jsonb_array_length(p_rows), actor) returning id into batch_id;
  for item in select value from jsonb_array_elements(p_rows) loop
    row_index := row_index + 1; row_status := 'imported'; error_text := null; entity_id := null;
    begin
      if p_kind = 'phones' then
        serial := btrim(coalesce(item->>'phone_serial', ''));
        if serial !~ '^[0-9]{3}$' then raise exception 'Serial must be exactly three digits'; end if;
        if exists(select 1 from public.phones where serial_number = serial) then row_status := 'skipped'; error_text := 'Phone serial already exists';
        else insert into public.phones(serial_number, created_by) values(serial, actor) returning id into entity_id; end if;
      elsif p_kind = 'supervisors' then
        name := btrim(coalesce(item->>'full_name', '')); code := upper(btrim(coalesce(item->>'supervisor_code', ''))); email_value := nullif(btrim(item->>'email'), '');
        if name = '' then raise exception 'Full name is required'; end if;
        if code = '' then code := 'SUP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)); end if;
        if exists(select 1 from public.supervisors where lower(supervisor_code) = lower(code)) then row_status := 'skipped'; error_text := 'Supervisor code already exists';
        else insert into public.supervisors(supervisor_code, full_name, email, created_by, updated_by) values(code, name, email_value, actor, actor) returning id into entity_id; end if;
      else
        name := btrim(coalesce(item->>'full_name', '')); code := upper(btrim(coalesce(item->>'enumerator_code', ''))); supervisor_id := null;
        if name = '' then raise exception 'Full name is required'; end if;
        if code = '' then code := 'ENU-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)); end if;
        if nullif(btrim(item->>'supervisor_code'), '') is not null then
          select id into supervisor_id from public.supervisors where lower(supervisor_code) = lower(btrim(item->>'supervisor_code'));
          if supervisor_id is null then raise exception 'Supervisor code % was not found', btrim(item->>'supervisor_code'); end if;
        end if;
        if exists(select 1 from public.enumerators where lower(enumerator_code) = lower(code)) then row_status := 'skipped'; error_text := 'Enumerator code already exists';
        else insert into public.enumerators(enumerator_code, full_name, usual_supervisor_id, created_by, updated_by) values(code, name, supervisor_id, actor, actor) returning id into entity_id; end if;
      end if;
    exception when others then row_status := 'failed'; error_text := sqlerrm;
    end;
    if row_status = 'imported' then imported := imported + 1; insert into public.audit_events(event_type, entity_type, entity_id, phone_id, actor_id, details) values('import.row_created', p_kind::text, entity_id, case when p_kind = 'phones' then entity_id else null end, actor, jsonb_build_object('batch_id', batch_id, 'row_number', row_index + 1));
    elsif row_status = 'skipped' then skipped := skipped + 1; errors := errors || jsonb_build_object('row', row_index + 1, 'status', row_status, 'message', error_text);
    else failed := failed + 1; errors := errors || jsonb_build_object('row', row_index + 1, 'status', row_status, 'message', error_text); end if;
    insert into public.import_results(batch_id, row_number, status, source_data, error_message) values(batch_id, row_index + 1, row_status, item, error_text);
  end loop;
  update public.import_batches set imported_rows = imported, skipped_rows = skipped, failed_rows = failed where id = batch_id;
  insert into public.audit_events(event_type, entity_type, entity_id, actor_id, details) values('import.completed', 'import_batch', batch_id, actor, jsonb_build_object('kind', p_kind, 'imported', imported, 'skipped', skipped, 'failed', failed));
  return jsonb_build_object('batch_id', batch_id, 'imported', imported, 'skipped', skipped, 'failed', failed, 'errors', errors);
end;
$$;

-- Security-invoker views keep the underlying RLS policies in force.
create view public.phone_register with (security_invoker = true) as
select p.id, p.serial_number, p.status, p.configured_at,
  config_actor.full_name as configured_by_name,
  coalesce(latest_config.survey_app_installed, false) as survey_app_installed,
  coalesce(latest_config.correct_form_loaded, false) as correct_form_loaded,
  coalesce(latest_config.login_sync_tested, false) as login_sync_tested,
  coalesce(latest_config.device_checked, false) as device_checked,
  c.id as active_checkout_id, c.enumerator_id, c.enumerator_name_snapshot as enumerator_name,
  c.supervisor_id, c.supervisor_name_snapshot as supervisor_name, c.collected_at,
  issue_actor.full_name as issued_by_name
from public.phones p
left join public.profiles config_actor on config_actor.id = p.configured_by
left join lateral (select * from public.configuration_records cr where cr.phone_id = p.id order by cr.recorded_at desc limit 1) latest_config on true
left join public.checkouts c on c.phone_id = p.id and c.returned_at is null
left join public.profiles issue_actor on issue_actor.id = c.issued_by;

create view public.movement_history with (security_invoker = true) as
select c.id, c.phone_id, p.serial_number, c.enumerator_id, c.enumerator_code_snapshot, c.enumerator_name_snapshot as enumerator_name,
  c.supervisor_id, c.supervisor_code_snapshot, c.supervisor_name_snapshot as supervisor_name,
  c.collected_at, c.returned_at, c.return_condition, c.fault_notes,
  issued.full_name as issued_by_name, returned.full_name as returned_by_name
from public.checkouts c join public.phones p on p.id = c.phone_id
join public.profiles issued on issued.id = c.issued_by left join public.profiles returned on returned.id = c.returned_by;

grant select on public.phone_register, public.movement_history to authenticated;

create or replace function public.prevent_history_delete()
returns trigger language plpgsql as $$ begin raise exception 'Historical records cannot be deleted'; end; $$;
create trigger protect_configuration_history before delete on public.configuration_records for each row execute function public.prevent_history_delete();
create trigger protect_checkout_history before delete on public.checkouts for each row execute function public.prevent_history_delete();
create trigger protect_fault_history before delete on public.faults for each row execute function public.prevent_history_delete();
create trigger protect_correction_history before delete on public.transaction_corrections for each row execute function public.prevent_history_delete();
create trigger protect_import_history before delete on public.import_batches for each row execute function public.prevent_history_delete();
create trigger protect_audit_history before delete on public.audit_events for each row execute function public.prevent_history_delete();

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_approved_user(), public.is_admin_user() to authenticated;
grant execute on function public.add_phone(text), public.configure_phone(uuid, boolean, boolean, boolean, boolean, text),
  public.issue_phone(uuid, uuid, uuid), public.return_phone(uuid, boolean, text),
  public.save_supervisor(uuid, text, text, text, boolean), public.save_enumerator(uuid, text, text, uuid, boolean),
  public.approve_account(uuid), public.set_account_enabled(uuid, boolean), public.promote_to_admin(uuid),
  public.link_supervisor_account(uuid, uuid), public.correct_checkout(uuid, uuid, uuid, text),
  public.process_import(public.import_kind, text, jsonb) to authenticated;

comment on table public.supervisors is 'Operational directory, separate from authentication accounts.';
comment on column public.phones.configured_at is 'Readiness completion is independent from current phone status.';
comment on function public.issue_phone is 'Atomically locks a phone, validates readiness/availability, creates one checkout, and marks it issued.';
comment on function public.return_phone is 'Atomically closes exactly one active checkout and records the authenticated receiving Admin.';
