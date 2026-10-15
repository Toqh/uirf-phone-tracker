alter table public.enumerators add column linked_profile_id uuid unique references public.profiles(id) on delete set null;

create or replace function public.link_enumerator_account(p_enumerator_id uuid, p_profile_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin();
begin
  if p_profile_id is not null and not exists(select 1 from public.profiles where id = p_profile_id and status = 'approved' and role = 'enumerator') then
    raise exception 'Select an approved Enumerator account';
  end if;
  update public.enumerators set linked_profile_id = p_profile_id, updated_at = now(), updated_by = actor where id = p_enumerator_id;
  if not found then raise exception 'Enumerator directory entry not found'; end if;
  insert into public.audit_events(event_type, entity_type, entity_id, actor_id, details)
  values('enumerator.account_linked', 'enumerator', p_enumerator_id, actor, jsonb_build_object('profile_id', p_profile_id));
end;
$$;

revoke execute on function public.link_enumerator_account(uuid, uuid) from public, anon;
grant execute on function public.link_enumerator_account(uuid, uuid) to authenticated;
