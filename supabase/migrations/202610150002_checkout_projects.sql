begin;

-- Older checkouts keep NULL: their project was not recorded.
alter table public.checkouts add column project text check (project in ('DASH', 'NUTRINT'));

-- Remove the legacy signature so new issues cannot bypass project validation.
drop function public.issue_phone(uuid, uuid, uuid);

create or replace function public.issue_phone(p_phone_id uuid, p_enumerator_id uuid, p_project text, p_supervisor_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin(); phone_record public.phones%rowtype; enumerator_record public.enumerators%rowtype; supervisor_record public.supervisors%rowtype; checkout_id uuid;
begin
  if p_project is null or p_project not in ('DASH', 'NUTRINT') then
    raise exception 'Select DASH or NUTRINT';
  end if;
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
  insert into public.checkouts(phone_id, enumerator_id, enumerator_code_snapshot, enumerator_name_snapshot, supervisor_id, supervisor_code_snapshot, supervisor_name_snapshot, issued_by, project)
  values(p_phone_id, p_enumerator_id, enumerator_record.enumerator_code, enumerator_record.full_name, p_supervisor_id, supervisor_record.supervisor_code, supervisor_record.full_name, actor, p_project)
  returning id into checkout_id;
  update public.phones set status = 'issued', updated_at = now() where id = p_phone_id;
  insert into public.audit_events(event_type, entity_type, entity_id, phone_id, actor_id, details)
  values('phone.issued', 'checkout', checkout_id, p_phone_id, actor, jsonb_build_object('project', p_project, 'enumerator_id', p_enumerator_id, 'enumerator_name', enumerator_record.full_name, 'supervisor_id', p_supervisor_id, 'supervisor_name', supervisor_record.full_name));
  return checkout_id;
exception when unique_violation then raise exception 'Phone is already issued';
end;
$$;

create or replace view public.phone_register with (security_invoker = true) as
select p.id, p.serial_number, p.status, p.configured_at,
  config_actor.full_name as configured_by_name,
  (p.configured_at is not null and coalesce(latest_config.survey_app_installed, false)) as survey_app_installed,
  (p.configured_at is not null and coalesce(latest_config.correct_form_loaded, false)) as correct_form_loaded,
  (p.configured_at is not null and coalesce(latest_config.login_sync_tested, false)) as login_sync_tested,
  (p.configured_at is not null and coalesce(latest_config.device_checked, false)) as device_checked,
  c.id as active_checkout_id, c.enumerator_id, c.enumerator_name_snapshot as enumerator_name,
  c.supervisor_id, c.supervisor_name_snapshot as supervisor_name, c.collected_at,
  issue_actor.full_name as issued_by_name, c.project
from public.phones p
left join public.profiles config_actor on config_actor.id = p.configured_by
left join lateral (select * from public.configuration_records cr where cr.phone_id = p.id order by cr.recorded_at desc limit 1) latest_config on true
left join public.checkouts c on c.phone_id = p.id and c.returned_at is null
left join public.profiles issue_actor on issue_actor.id = c.issued_by;

create or replace view public.movement_history with (security_invoker = true) as
select c.id, c.phone_id, p.serial_number, c.enumerator_id, c.enumerator_code_snapshot, c.enumerator_name_snapshot as enumerator_name,
  c.supervisor_id, c.supervisor_code_snapshot, c.supervisor_name_snapshot as supervisor_name,
  c.collected_at, c.returned_at, c.return_condition, c.fault_notes,
  issued.full_name as issued_by_name, returned.full_name as returned_by_name, c.project
from public.checkouts c join public.phones p on p.id = c.phone_id
join public.profiles issued on issued.id = c.issued_by left join public.profiles returned on returned.id = c.returned_by;

revoke execute on function public.issue_phone(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.issue_phone(uuid, uuid, text, uuid) to authenticated;

commit;
