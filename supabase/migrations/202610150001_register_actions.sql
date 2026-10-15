-- Reopen readiness without deleting the original checklist or audit records.
create or replace function public.reset_phone_checklist(p_phone_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin(); previous public.phones%rowtype;
begin
  if coalesce(length(btrim(p_reason)), 0) < 5 then raise exception 'A reason of at least five characters is required'; end if;
  select * into previous from public.phones where id = p_phone_id for update;
  if not found then raise exception 'Phone not found'; end if;
  if previous.status <> 'available' or previous.configured_at is null then
    raise exception 'Only available phones with a completed checklist can be reset';
  end if;
  if exists(select 1 from public.checkouts where phone_id = p_phone_id and returned_at is null) then
    raise exception 'Return the phone before resetting its checklist';
  end if;
  update public.phones set status = 'awaiting_configuration', configured_at = null, configured_by = null, updated_at = now() where id = p_phone_id;
  insert into public.audit_events(event_type, entity_type, entity_id, phone_id, actor_id, details)
  values('phone.checklist_reset', 'phone', p_phone_id, p_phone_id, actor,
    jsonb_build_object('reason', btrim(p_reason), 'previous_configured_at', previous.configured_at, 'previous_configured_by', previous.configured_by));
  return p_phone_id;
end;
$$;

-- Change only the active flag; do not overwrite names or links from stale UI data.
create or replace function public.set_directory_active(p_kind text, p_id uuid, p_active boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin(); previous_active boolean;
begin
  if p_active is null then raise exception 'Active state is required'; end if;
  if p_kind = 'enumerator' then
    select active into previous_active from public.enumerators where id = p_id for update;
    if not found then raise exception 'Enumerator not found'; end if;
    update public.enumerators set active = p_active, updated_at = now(), updated_by = actor where id = p_id;
  elsif p_kind = 'supervisor' then
    select active into previous_active from public.supervisors where id = p_id for update;
    if not found then raise exception 'Supervisor not found'; end if;
    update public.supervisors set active = p_active, updated_at = now(), updated_by = actor where id = p_id;
  else raise exception 'Invalid directory kind';
  end if;
  if previous_active is distinct from p_active then
    insert into public.audit_events(event_type, entity_type, entity_id, actor_id, details)
    values(p_kind || '.active_changed', p_kind, p_id, actor, jsonb_build_object('previous_active', previous_active, 'active', p_active));
  end if;
  return p_id;
end;
$$;

-- A historical completed checklist does not imply current readiness after reset.
create or replace view public.phone_register with (security_invoker = true) as
select p.id, p.serial_number, p.status, p.configured_at,
  config_actor.full_name as configured_by_name,
  (p.configured_at is not null and coalesce(latest_config.survey_app_installed, false)) as survey_app_installed,
  (p.configured_at is not null and coalesce(latest_config.correct_form_loaded, false)) as correct_form_loaded,
  (p.configured_at is not null and coalesce(latest_config.login_sync_tested, false)) as login_sync_tested,
  (p.configured_at is not null and coalesce(latest_config.device_checked, false)) as device_checked,
  c.id as active_checkout_id, c.enumerator_id, c.enumerator_name_snapshot as enumerator_name,
  c.supervisor_id, c.supervisor_name_snapshot as supervisor_name, c.collected_at,
  issue_actor.full_name as issued_by_name
from public.phones p
left join public.profiles config_actor on config_actor.id = p.configured_by
left join lateral (select * from public.configuration_records cr where cr.phone_id = p.id order by cr.recorded_at desc limit 1) latest_config on true
left join public.checkouts c on c.phone_id = p.id and c.returned_at is null
left join public.profiles issue_actor on issue_actor.id = c.issued_by;

revoke execute on function public.reset_phone_checklist(uuid, text), public.set_directory_active(text, uuid, boolean) from public, anon;
grant execute on function public.reset_phone_checklist(uuid, text), public.set_directory_active(text, uuid, boolean) to authenticated;
