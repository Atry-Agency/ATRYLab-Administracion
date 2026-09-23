-- Cotizaciones ATRY LAB · migración aditiva e idempotente
do $$ begin create type public.quote_status as enum ('draft','generated','sent','accepted','rejected','expired','replaced'); exception when duplicate_object then null; end $$;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(), request_id text not null references public.requests(id) on delete cascade,
  quote_number text not null, version integer not null default 1 check(version>0), status public.quote_status not null default 'draft',
  issue_date date not null default current_date, valid_until date not null default (current_date + 7), currency text not null default 'UYU' check(currency in ('UYU','USD')),
  client_name text not null, client_company text, client_phone text, client_email text,
  items_subtotal numeric(12,2) not null default 0, design_fee numeric(12,2) not null default 0, personalization_fee numeric(12,2) not null default 0,
  extras_fee numeric(12,2) not null default 0, packaging_fee numeric(12,2) not null default 0, shipping_fee numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0, other_fee numeric(12,2) not null default 0, total numeric(12,2) not null default 0,
  production_terms text, estimated_delivery date, delivery_method text, delivery_terms text,
  payment_method text, deposit_percent numeric(5,2), deposit_amount numeric(12,2), payment_terms text, observations text,
  internal_data jsonb not null default '{}'::jsonb, snapshot jsonb not null default '{}'::jsonb,
  pdf_path text, generated_at timestamptz, sent_at timestamptz, accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(quote_number,version)
);
create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.quotes(id) on delete cascade, sort_order integer not null default 0,
  product_name text not null, description text, quantity numeric(12,2) not null default 1 check(quantity>0), material text, colors text, dimensions text,
  finish text, personalization text, design_description text, unit_price numeric(12,2) not null default 0, subtotal numeric(12,2) not null default 0, created_at timestamptz not null default now()
);
create sequence if not exists public.quote_number_seq start 1;
create or replace function public.next_quote_number()
returns text language plpgsql security definer set search_path=public as $$ begin return 'AT-'||extract(year from current_date)::int||'-'||lpad(nextval('quote_number_seq')::text,4,'0'); end; $$;

alter table public.quotes enable row level security; alter table public.quote_items enable row level security;
drop policy if exists "staff read quotes" on public.quotes; drop policy if exists "managers manage quotes" on public.quotes;
drop policy if exists "staff read quote items" on public.quote_items; drop policy if exists "managers manage quote items" on public.quote_items;
create policy "staff read quotes" on public.quotes for select to authenticated using(public.is_staff());
create policy "managers manage quotes" on public.quotes for all to authenticated using(public.is_manager()) with check(public.is_manager());
create policy "staff read quote items" on public.quote_items for select to authenticated using(public.is_staff());
create policy "managers manage quote items" on public.quote_items for all to authenticated using(public.is_manager()) with check(public.is_manager());
grant select,insert,update,delete on public.quotes,public.quote_items to authenticated;
grant usage,select on sequence public.quote_number_seq to authenticated;
grant execute on function public.next_quote_number() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('quote-pdfs','quote-pdfs',false,10485760,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];
drop policy if exists "staff read quote pdfs" on storage.objects; drop policy if exists "managers upload quote pdfs" on storage.objects; drop policy if exists "managers update quote pdfs" on storage.objects; drop policy if exists "managers delete quote pdfs" on storage.objects;
create policy "staff read quote pdfs" on storage.objects for select to authenticated using(bucket_id='quote-pdfs' and public.is_staff());
create policy "managers upload quote pdfs" on storage.objects for insert to authenticated with check(bucket_id='quote-pdfs' and public.is_manager());
create policy "managers update quote pdfs" on storage.objects for update to authenticated using(bucket_id='quote-pdfs' and public.is_manager()) with check(bucket_id='quote-pdfs' and public.is_manager());
create policy "managers delete quote pdfs" on storage.objects for delete to authenticated using(bucket_id='quote-pdfs' and public.is_manager());

do $$ begin alter publication supabase_realtime add table public.quotes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.quote_items; exception when duplicate_object then null; end $$;
