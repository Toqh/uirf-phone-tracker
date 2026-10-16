-- Apply earlier migrations first, especially 202610150002_checkout_projects.sql
-- and 202610150005_enumerator_account_links.sql.
-- Restrictive policies also constrain the original approved-user read policies.
begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'checkouts' and column_name = 'project'
  ) then
    raise exception 'Apply the full 202610150002_checkout_projects.sql migration before this migration (not just an ALTER TABLE)';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'enumerators' and column_name = 'linked_profile_id'
  ) then
    raise exception 'Apply 202610150005_enumerator_account_links.sql before this migration';
  end if;
end;
$$;

create or replace function public.can_view_register()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved' and role in ('admin', 'supervisor')
  );
$$;

-- Resolve identity from the stored account link, never client metadata or a name.
create or replace function public.current_enumerator_id()
returns uuid language sql stable security definer set search_path = public as $$
  select e.id from public.enumerators e
  join public.profiles p on p.id = e.linked_profile_id
  where p.id = auth.uid() and p.status = 'approved' and p.role::text = 'enumerator';
$$;

-- Definer context avoids recursive RLS between phones and checkouts.
-- The caller can only check custody for their own authenticated account.
create or replace function public.enumerator_holds_phone(p_phone_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.checkouts c
    join public.phones p on p.id = c.phone_id
    where c.phone_id = p_phone_id and c.returned_at is null
      and p.status = 'issued' and c.enumerator_id = public.current_enumerator_id()
  );
$$;

revoke execute on function public.can_view_register(), public.current_enumerator_id(), public.enumerator_holds_phone(uuid) from public, anon;
grant execute on function public.can_view_register(), public.current_enumerator_id(), public.enumerator_holds_phone(uuid) to authenticated;

create policy limit_enumerator_profiles on public.profiles as restrictive for select to authenticated
  using (id = auth.uid() or public.can_view_register());
create policy limit_enumerator_directory on public.enumerators as restrictive for select to authenticated
  using (public.can_view_register() or id = public.current_enumerator_id());
create policy limit_enumerator_supervisors on public.supervisors as restrictive for select to authenticated
  using (public.can_view_register());
create policy limit_enumerator_phones on public.phones as restrictive for select to authenticated
  using (public.can_view_register() or public.enumerator_holds_phone(id));
create policy limit_enumerator_checkouts on public.checkouts as restrictive for select to authenticated
  using (public.can_view_register() or (
    returned_at is null and enumerator_id = public.current_enumerator_id()
    and public.enumerator_holds_phone(phone_id)
  ));

-- History, faults, corrections and other people's accounts are not part of My phones.
create policy limit_enumerator_configuration on public.configuration_records as restrictive for select to authenticated
  using (public.can_view_register());
create policy limit_enumerator_faults on public.faults as restrictive for select to authenticated
  using (public.can_view_register());
create policy limit_enumerator_corrections on public.transaction_corrections as restrictive for select to authenticated
  using (public.can_view_register());
create policy limit_enumerator_audit on public.audit_events as restrictive for select to authenticated
  using (public.can_view_register());

-- Keep the report view unavailable even if a former Admin now has an Enumerator role.
create or replace view public.movement_history with (security_invoker = true) as
select c.id, c.phone_id, p.serial_number, c.enumerator_id, c.enumerator_code_snapshot, c.enumerator_name_snapshot as enumerator_name,
  c.supervisor_id, c.supervisor_code_snapshot, c.supervisor_name_snapshot as supervisor_name,
  c.collected_at, c.returned_at, c.return_condition, c.fault_notes,
  issued.full_name as issued_by_name, returned.full_name as returned_by_name, c.project
from public.checkouts c join public.phones p on p.id = c.phone_id
join public.profiles issued on issued.id = c.issued_by left join public.profiles returned on returned.id = c.returned_by
where public.can_view_register();

commit;
