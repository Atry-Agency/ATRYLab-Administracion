-- Exponer únicamente el contenido público de la sección Experiencias.
-- No concede acceso anónimo a app_settings ni a otros ajustes internos.
create or replace function public.get_public_experiences()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select value from public.app_settings where key = 'home_experiences' limit 1;
$$;

revoke all on function public.get_public_experiences() from public;
grant execute on function public.get_public_experiences() to anon, authenticated;
