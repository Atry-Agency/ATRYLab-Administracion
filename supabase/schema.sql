-- ATRY LAB Administración · esquema inicial seguro
create extension if not exists pgcrypto;

create type public.app_role as enum ('owner','operator','viewer');
create type public.request_status as enum ('new','reviewing','quoted','approved','printing','ready','delivered','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'viewer',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.requests (
  id text primary key,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_company text,
  customer_phone text,
  customer_email text,
  title text not null,
  category text,
  quantity integer not null default 1 check (quantity > 0),
  deadline text,
  status public.request_status not null default 'new',
  priority text not null default 'normal' check (priority in ('normal','high')),
  amount numeric(12,2),
  deposit numeric(12,2),
  notes text,
  configuration jsonb not null default '{}'::jsonb,
  source text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id text not null references public.requests(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  created_at timestamptz not null default now()
);

create table public.status_history (
  id bigint generated always as identity primary key,
  request_id text not null references public.requests(id) on delete cascade,
  from_status public.request_status,
  to_status public.request_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table public.catalog_items (
  id text primary key,
  name text not null,
  category text not null,
  description text,
  min_quantity integer not null default 1 check (min_quantity > 0),
  active boolean not null default true,
  featured boolean not null default false,
  sort_order integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.production_jobs (
  id uuid primary key default gen_random_uuid(),
  request_id text not null references public.requests(id) on delete cascade,
  material text,
  color text,
  grams_estimated numeric(10,2),
  print_minutes_estimated integer,
  printer_name text,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  reprints integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and active=true); $$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and active=true and role in ('owner','operator')); $$;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.requests enable row level security;
alter table public.request_attachments enable row level security;
alter table public.status_history enable row level security;
alter table public.catalog_items enable row level security;
alter table public.production_jobs enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_log enable row level security;

create policy "staff read profiles" on public.profiles for select to authenticated using (public.is_staff());
create policy "staff read customers" on public.customers for select to authenticated using (public.is_staff());
create policy "managers manage customers" on public.customers for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "staff read requests" on public.requests for select to authenticated using (public.is_staff());
create policy "managers manage requests" on public.requests for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "staff read attachments" on public.request_attachments for select to authenticated using (public.is_staff());
create policy "managers manage attachments" on public.request_attachments for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "staff read history" on public.status_history for select to authenticated using (public.is_staff());
create policy "managers add history" on public.status_history for insert to authenticated with check (public.is_manager());
create policy "staff read catalog" on public.catalog_items for select to authenticated using (public.is_staff());
create policy "managers manage catalog" on public.catalog_items for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "staff read production" on public.production_jobs for select to authenticated using (public.is_staff());
create policy "managers manage production" on public.production_jobs for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "staff read settings" on public.app_settings for select to authenticated using (public.is_staff());
create policy "owners manage settings" on public.app_settings for all to authenticated using (exists(select 1 from public.profiles where id=auth.uid() and role='owner' and active=true)) with check (exists(select 1 from public.profiles where id=auth.uid() and role='owner' and active=true));
create policy "staff read audit" on public.audit_log for select to authenticated using (public.is_staff());

insert into public.catalog_items(id,name,category,min_quantity,active,featured,sort_order) values
('llaveros','Llaveros personalizados','Tu marca',10,true,true,10),
('porta-qr','Porta QR','Negocios',1,true,true,20),
('logos-3d','Logos 3D','Tu marca',1,true,false,30),
('souvenirs','Souvenirs','Eventos',10,true,true,40),
('trofeos','Trofeos','Eventos',1,true,true,50),
('figuras-referencia','Figuras desde referencia','Figuras',1,true,false,60)
on conflict (id) do nothing;

-- El primer administrador se agrega luego de crear su usuario en Authentication:
-- insert into public.profiles(id,full_name,role) values ('UUID-DEL-USUARIO','Administrador ATRY','owner');
