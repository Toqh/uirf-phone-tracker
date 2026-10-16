-- Signup may select either viewing role; approval and Admin access remain Admin-only.
-- Older clients without a selection retain the previous Supervisor default.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles (id, full_name, email, role, status)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'New user'), '@', 1)),
    coalesce(new.email, ''),
    case when new.raw_user_meta_data ->> 'role' = 'enumerator'
      then 'enumerator'::public.account_role
      else 'supervisor'::public.account_role end,
    'pending'
  );
  return new;
end;
$$;
