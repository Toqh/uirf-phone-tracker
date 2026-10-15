-- New enum values are used only by later RPC calls, after this migration commits.
alter type public.account_role add value if not exists 'enumerator';

create or replace function public.set_account_role(p_profile_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid; previous_role public.account_role;
begin
  -- Serialize role changes and recheck the actor after acquiring the lock.
  perform pg_advisory_xact_lock(731204);
  actor := public.require_admin();
  if p_role is null or p_role not in ('admin', 'supervisor', 'enumerator') then
    raise exception 'Select Admin, Supervisor, or Enumerator';
  end if;
  if p_profile_id = actor then raise exception 'You cannot change your own role'; end if;
  select role into previous_role from public.profiles where id = p_profile_id and status = 'approved' for update;
  if not found then raise exception 'Approve and enable the account before assigning a role'; end if;
  if previous_role::text = p_role then return; end if;
  update public.profiles set role = p_role::public.account_role, updated_at = now() where id = p_profile_id;
  insert into public.audit_events(event_type, entity_type, entity_id, actor_id, details)
  values('account.role_changed', 'profile', p_profile_id, actor,
    jsonb_build_object('previous_role', previous_role, 'role', p_role));
end;
$$;

revoke execute on function public.set_account_role(uuid, text) from public, anon;
grant execute on function public.set_account_role(uuid, text) to authenticated;

-- Preserve compatibility for older deployed clients while sharing validation/audit.
create or replace function public.promote_to_admin(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.set_account_role(p_profile_id, 'admin');
end;
$$;
