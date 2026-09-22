-- Sincronización automática del catálogo público y del panel administrativo.
-- Es seguro ejecutar este archivo más de una vez.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'catalog_items',
    'requests',
    'customers',
    'production_jobs',
    'request_attachments',
    'app_settings',
    'profiles'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

-- El navegador público solo puede observar artículos que ya son visibles.
grant select on public.catalog_items to anon;

drop policy if exists "public read visible catalog" on public.catalog_items;
create policy "public read visible catalog"
on public.catalog_items
for select
to anon
using (
  active = true
  and publication_status in ('published', 'upcoming')
);
