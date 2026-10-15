begin;

-- A supervisor may be the direct holder, without an enumerator.
alter table public.checkouts
  alter column enumerator_id drop not null,
  alter column enumerator_code_snapshot drop not null,
  alter column enumerator_name_snapshot drop not null,
  add constraint checkout_has_holder check (enumerator_id is not null or supervisor_id is not null);

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
  if p_enumerator_id is null and p_supervisor_id is null then
    raise exception 'Select an enumerator or supervisor';
  end if;
  if p_enumerator_id is not null then
    select * into enumerator_record from public.enumerators where id = p_enumerator_id and active;
    if not found then raise exception 'Select an active enumerator'; end if;
  end if;
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

create or replace function public.correct_checkout(p_checkout_id uuid, p_enumerator_id uuid, p_supervisor_id uuid default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin(); old_record public.checkouts%rowtype; enum_record public.enumerators%rowtype; sup_record public.supervisors%rowtype; old_json jsonb; new_json jsonb;
begin
  if coalesce(length(btrim(p_reason)), 0) < 5 then raise exception 'A correction reason of at least five characters is required'; end if;
  select * into old_record from public.checkouts where id = p_checkout_id for update;
  if not found then raise exception 'Checkout not found'; end if;
  if p_enumerator_id is null and p_supervisor_id is null then raise exception 'Select an enumerator or supervisor'; end if;
  if p_enumerator_id is not null then
    select * into enum_record from public.enumerators where id = p_enumerator_id;
    if not found then raise exception 'Enumerator not found'; end if;
  end if;
  if p_supervisor_id is not null then select * into sup_record from public.supervisors where id = p_supervisor_id; if not found then raise exception 'Supervisor not found'; end if; end if;
  old_json := jsonb_build_object('enumerator_id', old_record.enumerator_id, 'enumerator_code', old_record.enumerator_code_snapshot, 'enumerator_name', old_record.enumerator_name_snapshot, 'supervisor_id', old_record.supervisor_id, 'supervisor_code', old_record.supervisor_code_snapshot, 'supervisor_name', old_record.supervisor_name_snapshot);
  new_json := jsonb_build_object('enumerator_id', enum_record.id, 'enumerator_code', enum_record.enumerator_code, 'enumerator_name', enum_record.full_name, 'supervisor_id', sup_record.id, 'supervisor_code', sup_record.supervisor_code, 'supervisor_name', sup_record.full_name);
  update public.checkouts set enumerator_id = enum_record.id, enumerator_code_snapshot = enum_record.enumerator_code, enumerator_name_snapshot = enum_record.full_name, supervisor_id = sup_record.id, supervisor_code_snapshot = sup_record.supervisor_code, supervisor_name_snapshot = sup_record.full_name where id = p_checkout_id;
  insert into public.transaction_corrections(checkout_id, reason, previous_values, corrected_values, recorded_by) values(p_checkout_id, btrim(p_reason), old_json, new_json, actor);
  insert into public.audit_events(event_type, entity_type, entity_id, phone_id, actor_id, details) values('checkout.corrected', 'checkout', p_checkout_id, old_record.phone_id, actor, jsonb_build_object('reason', btrim(p_reason), 'previous', old_json, 'corrected', new_json));
end;
$$;

-- Replacing functions preserves their existing restricted execute permissions.
commit;

