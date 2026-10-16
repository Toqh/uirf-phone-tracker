-- Prerequisite: apply 202610150004_account_roles.sql in a separate run first.
-- If SQL Editor reports invalid enum value "enumerator", run this statement ALONE:
--   alter type public.account_role add value if not exists 'enumerator';
-- Wait for that run to commit, then run this entire migration again.
-- PostgreSQL cannot use a newly added enum value in the same transaction.

-- Viewing accounts no longer require administrator approval.
-- Role selection remains limited to Enumerator and Supervisor; email verification
-- and session creation are still controlled by Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles (id, full_name, email, role, status, approved_at)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'New user'), '@', 1)),
    coalesce(new.email, ''),
    case when new.raw_user_meta_data ->> 'role' = 'enumerator'
      then 'enumerator'::public.account_role
      else 'supervisor'::public.account_role end,
    'approved',
    now()
  );
  return new;
end;
$$;

-- Release existing pending viewing accounts without re-enabling disabled accounts.
-- approved_by remains null because no administrator approved these accounts.
update public.profiles
set status = 'approved', approved_at = now(), updated_at = now()
where status = 'pending' and role in ('enumerator', 'supervisor');
