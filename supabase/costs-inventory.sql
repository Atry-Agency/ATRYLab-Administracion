-- ATRY LAB · costos, inventario de filamentos y sincronización financiera
-- Migración aditiva e idempotente. No elimina ni reescribe datos existentes.

create table if not exists public.filament_rolls (
  id uuid primary key default gen_random_uuid(),
  material text not null,
  color text not null,
  brand text,
  lot_code text,
  initial_grams numeric(10,2) not null check (initial_grams > 0),
  current_grams numeric(10,2) not null check (current_grams >= 0),
  total_cost numeric(12,2) not null default 0 check (total_cost >= 0),
  currency text not null default 'UYU' check (currency in ('UYU','USD')),
  low_stock_threshold numeric(10,2) not null default 150 check (low_stock_threshold >= 0),
  status text not null default 'available' check (status in ('available','low','exhausted','archived')),
  purchased_at date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.filament_movements (
  id bigint generated always as identity primary key,
  roll_id uuid not null references public.filament_rolls(id) on delete cascade,
  request_id text references public.requests(id) on delete set null,
  production_job_id uuid references public.production_jobs(id) on delete set null,
  movement_type text not null check (movement_type in ('initial','purchase','consume','adjust','waste','reprint','exhaust','reversal')),
  grams_delta numeric(10,2) not null check (grams_delta <> 0),
  grams_before numeric(10,2) not null check (grams_before >= 0),
  grams_after numeric(10,2) not null check (grams_after >= 0),
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.cost_estimates (
  id uuid primary key default gen_random_uuid(),
  request_id text not null references public.requests(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  version integer not null default 1 check (version > 0),
  status text not null default 'active' check (status in ('draft','active','superseded','cancelled')),
  currency text not null default 'UYU' check (currency in ('UYU','USD')),
  exchange_rate numeric(12,4) not null default 1 check (exchange_rate > 0),
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  print_minutes numeric(12,2) not null default 0 check (print_minutes >= 0),
  printer_watts numeric(12,2) not null default 0 check (printer_watts >= 0),
  electricity_rate numeric(12,4) not null default 0 check (electricity_rate >= 0),
  machine_hourly_rate numeric(12,2) not null default 0 check (machine_hourly_rate >= 0),
  labor_minutes numeric(12,2) not null default 0 check (labor_minutes >= 0),
  labor_hourly_rate numeric(12,2) not null default 0 check (labor_hourly_rate >= 0),
  design_minutes numeric(12,2) not null default 0 check (design_minutes >= 0),
  design_hourly_rate numeric(12,2) not null default 0 check (design_hourly_rate >= 0),
  waste_percent numeric(5,2) not null default 5 check (waste_percent between 0 and 100),
  target_margin_percent numeric(5,2) not null default 40 check (target_margin_percent >= 0 and target_margin_percent < 100),
  material_cost numeric(12,2) not null default 0,
  electricity_cost numeric(12,2) not null default 0,
  machine_cost numeric(12,2) not null default 0,
  labor_cost numeric(12,2) not null default 0,
  design_cost numeric(12,2) not null default 0,
  consumables_cost numeric(12,2) not null default 0,
  packaging_cost numeric(12,2) not null default 0,
  other_cost numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  suggested_price numeric(12,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(request_id, version)
);

create table if not exists public.cost_estimate_lines (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.cost_estimates(id) on delete cascade,
  line_type text not null check (line_type in ('filament','consumable','packaging','other')),
  filament_roll_id uuid references public.filament_rolls(id) on delete set null,
  label text not null,
  quantity numeric(12,3) not null default 0 check (quantity >= 0),
  unit text not null default 'un',
  unit_cost numeric(12,4) not null default 0 check (unit_cost >= 0),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.filament_reservations (
  id uuid primary key default gen_random_uuid(),
  roll_id uuid not null references public.filament_rolls(id) on delete cascade,
  request_id text not null references public.requests(id) on delete cascade,
  cost_estimate_id uuid references public.cost_estimates(id) on delete set null,
  grams numeric(10,2) not null check (grams > 0),
  status text not null default 'active' check (status in ('active','consumed','released')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  released_at timestamptz,
  release_reason text
);

create unique index if not exists filament_active_reservation_unique
on public.filament_reservations(roll_id, request_id, cost_estimate_id)
where status = 'active';

create index if not exists filament_roll_lookup_idx on public.filament_rolls(status, material, color);
create index if not exists filament_movements_roll_idx on public.filament_movements(roll_id, created_at desc);
create index if not exists filament_reservations_request_idx on public.filament_reservations(request_id, status);
create index if not exists cost_estimates_request_idx on public.cost_estimates(request_id, status, version desc);

create table if not exists public.finance_sync_records (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique references public.requests(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  sheet_id text not null,
  sheet_name text not null default 'VENTAS',
  external_key text not null unique,
  sheet_row integer,
  sync_status text not null default 'pending' check (sync_status in ('pending','syncing','synced','cancelled','deleted','error')),
  last_action text,
  last_error text,
  synced_at timestamptz,
  cancelled_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.filament_rolls enable row level security;
alter table public.filament_movements enable row level security;
alter table public.cost_estimates enable row level security;
alter table public.cost_estimate_lines enable row level security;
alter table public.filament_reservations enable row level security;
alter table public.finance_sync_records enable row level security;

drop policy if exists "staff read filament rolls" on public.filament_rolls;
drop policy if exists "managers manage filament rolls" on public.filament_rolls;
create policy "staff read filament rolls" on public.filament_rolls for select to authenticated using (public.is_staff());
create policy "managers manage filament rolls" on public.filament_rolls for all to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists "staff read filament movements" on public.filament_movements;
drop policy if exists "managers add filament movements" on public.filament_movements;
create policy "staff read filament movements" on public.filament_movements for select to authenticated using (public.is_staff());
create policy "managers add filament movements" on public.filament_movements for insert to authenticated with check (public.is_manager());

drop policy if exists "staff read cost estimates" on public.cost_estimates;
drop policy if exists "managers manage cost estimates" on public.cost_estimates;
create policy "staff read cost estimates" on public.cost_estimates for select to authenticated using (public.is_staff());
create policy "managers manage cost estimates" on public.cost_estimates for all to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists "staff read cost lines" on public.cost_estimate_lines;
drop policy if exists "managers manage cost lines" on public.cost_estimate_lines;
create policy "staff read cost lines" on public.cost_estimate_lines for select to authenticated using (public.is_staff());
create policy "managers manage cost lines" on public.cost_estimate_lines for all to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists "staff read reservations" on public.filament_reservations;
drop policy if exists "managers manage reservations" on public.filament_reservations;
create policy "staff read reservations" on public.filament_reservations for select to authenticated using (public.is_staff());
create policy "managers manage reservations" on public.filament_reservations for all to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists "staff read finance sync" on public.finance_sync_records;
drop policy if exists "managers manage finance sync" on public.finance_sync_records;
create policy "staff read finance sync" on public.finance_sync_records for select to authenticated using (public.is_staff());
create policy "managers manage finance sync" on public.finance_sync_records for all to authenticated using (public.is_manager()) with check (public.is_manager());

grant select, insert, update, delete on public.filament_rolls, public.cost_estimates,
  public.cost_estimate_lines, public.filament_reservations, public.finance_sync_records to authenticated;
grant select, insert on public.filament_movements to authenticated;
grant usage, select on sequence public.filament_movements_id_seq to authenticated;

create or replace function public.filament_available_grams(p_roll_id uuid)
returns numeric language sql stable security invoker set search_path=public
as $$
  select greatest(0, r.current_grams - coalesce((
    select sum(fr.grams) from public.filament_reservations fr
    where fr.roll_id=r.id and fr.status='active'
  ),0)) from public.filament_rolls r where r.id=p_roll_id;
$$;

create or replace function public.create_filament_roll(
  p_material text, p_color text, p_initial_grams numeric, p_total_cost numeric default 0,
  p_brand text default null, p_lot_code text default null, p_currency text default 'UYU',
  p_low_stock_threshold numeric default 150, p_purchased_at date default current_date, p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.is_manager() then raise exception 'Acceso denegado'; end if;
  if coalesce(trim(p_material),'')='' or coalesce(trim(p_color),'')='' or p_initial_grams<=0 then raise exception 'Datos de rollo inválidos'; end if;
  insert into public.filament_rolls(material,color,brand,lot_code,initial_grams,current_grams,total_cost,currency,low_stock_threshold,status,purchased_at,notes,created_by)
  values(trim(p_material),trim(p_color),nullif(trim(p_brand),''),nullif(trim(p_lot_code),''),p_initial_grams,p_initial_grams,greatest(coalesce(p_total_cost,0),0),coalesce(p_currency,'UYU'),greatest(coalesce(p_low_stock_threshold,150),0),case when p_initial_grams<=coalesce(p_low_stock_threshold,150) then 'low' else 'available' end,p_purchased_at,p_notes,auth.uid())
  returning id into v_id;
  insert into public.filament_movements(roll_id,movement_type,grams_delta,grams_before,grams_after,reason,created_by)
  values(v_id,'initial',p_initial_grams,0,p_initial_grams,'Alta del rollo',auth.uid());
  return v_id;
end $$;

create or replace function public.record_filament_movement(
  p_roll_id uuid, p_grams_delta numeric, p_movement_type text, p_reason text,
  p_request_id text default null, p_production_job_id uuid default null
) returns numeric language plpgsql security definer set search_path=public as $$
declare v_roll public.filament_rolls%rowtype; v_after numeric;
begin
  if not public.is_manager() then raise exception 'Acceso denegado'; end if;
  if p_grams_delta=0 or coalesce(trim(p_reason),'')='' then raise exception 'Movimiento inválido'; end if;
  select * into v_roll from public.filament_rolls where id=p_roll_id for update;
  if not found then raise exception 'Rollo no encontrado'; end if;
  v_after:=round(v_roll.current_grams+p_grams_delta,2);
  if v_after<0 then raise exception 'El movimiento dejaría el stock negativo'; end if;
  update public.filament_rolls set current_grams=v_after,
    status=case when v_after=0 then 'exhausted' when v_after<=low_stock_threshold then 'low' else 'available' end,
    updated_at=now() where id=p_roll_id;
  insert into public.filament_movements(roll_id,request_id,production_job_id,movement_type,grams_delta,grams_before,grams_after,reason,created_by)
  values(p_roll_id,p_request_id,p_production_job_id,p_movement_type,p_grams_delta,v_roll.current_grams,v_after,trim(p_reason),auth.uid());
  return v_after;
end $$;

create or replace function public.reserve_request_filaments(p_request_id text, p_estimate_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_line record; v_available numeric; v_count integer:=0;
begin
  if not public.is_manager() then raise exception 'Acceso denegado'; end if;
  if not exists(select 1 from public.cost_estimates where id=p_estimate_id and request_id=p_request_id) then raise exception 'Cálculo de costos inválido'; end if;
  update public.filament_reservations set status='released',released_at=now(),release_reason='Reemplazada por un nuevo cálculo'
  where request_id=p_request_id and status='active' and cost_estimate_id is distinct from p_estimate_id;
  for v_line in select filament_roll_id,quantity from public.cost_estimate_lines where estimate_id=p_estimate_id and line_type='filament' and filament_roll_id is not null and quantity>0 loop
    if exists(select 1 from public.filament_reservations where request_id=p_request_id and cost_estimate_id=p_estimate_id and roll_id=v_line.filament_roll_id and status='active') then continue; end if;
    perform 1 from public.filament_rolls where id=v_line.filament_roll_id for update;
    v_available:=public.filament_available_grams(v_line.filament_roll_id);
    if v_available<v_line.quantity then raise exception 'Stock insuficiente: disponibles % g, requeridos % g',v_available,v_line.quantity; end if;
    insert into public.filament_reservations(roll_id,request_id,cost_estimate_id,grams,created_by)
    values(v_line.filament_roll_id,p_request_id,p_estimate_id,v_line.quantity,auth.uid());
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

create or replace function public.release_request_filaments(p_request_id text, p_reason text default 'Solicitud cancelada')
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  if not public.is_manager() then raise exception 'Acceso denegado'; end if;
  update public.filament_reservations set status='released',released_at=now(),release_reason=coalesce(nullif(trim(p_reason),''),'Reserva liberada')
  where request_id=p_request_id and status='active';
  get diagnostics v_count=row_count; return v_count;
end $$;

create or replace function public.consume_request_filaments(p_request_id text)
returns integer language plpgsql security definer set search_path=public as $$
declare v_res record; v_roll public.filament_rolls%rowtype; v_after numeric; v_job uuid; v_count integer:=0;
begin
  if not public.is_manager() then raise exception 'Acceso denegado'; end if;
  select id into v_job from public.production_jobs where request_id=p_request_id order by created_at desc limit 1;
  for v_res in select * from public.filament_reservations where request_id=p_request_id and status='active' order by created_at for update loop
    select * into v_roll from public.filament_rolls where id=v_res.roll_id for update;
    v_after:=round(v_roll.current_grams-v_res.grams,2);
    if v_after<0 then raise exception 'Stock físico insuficiente para consumir la reserva'; end if;
    update public.filament_rolls set current_grams=v_after,status=case when v_after=0 then 'exhausted' when v_after<=low_stock_threshold then 'low' else 'available' end,updated_at=now() where id=v_roll.id;
    insert into public.filament_movements(roll_id,request_id,production_job_id,movement_type,grams_delta,grams_before,grams_after,reason,created_by)
    values(v_roll.id,p_request_id,v_job,'consume',-v_res.grams,v_roll.current_grams,v_after,'Consumo reservado al iniciar producción',auth.uid());
    update public.filament_reservations set status='consumed',consumed_at=now() where id=v_res.id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

grant execute on function public.filament_available_grams(uuid) to authenticated;
grant execute on function public.create_filament_roll(text,text,numeric,numeric,text,text,text,numeric,date,text) to authenticated;
grant execute on function public.record_filament_movement(uuid,numeric,text,text,text,uuid) to authenticated;
grant execute on function public.reserve_request_filaments(text,uuid) to authenticated;
grant execute on function public.release_request_filaments(text,text) to authenticated;
grant execute on function public.consume_request_filaments(text) to authenticated;

insert into public.app_settings(key,value)
values('cost_parameters','{"electricity_rate":12.5,"printer_watts":120,"machine_hourly_rate":45,"labor_hourly_rate":300,"design_hourly_rate":400,"waste_percent":5,"target_margin_percent":40,"low_stock_threshold":150,"finance_sheet_id":"1T29D28a57_4Ng1rP8U8WlccW6CjJgu7CjNGnOERjim8","finance_sheet_name":"VENTAS"}'::jsonb)
on conflict(key) do nothing;

do $$ begin alter publication supabase_realtime add table public.filament_rolls; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.filament_movements; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.filament_reservations; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.cost_estimates; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.cost_estimate_lines; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.finance_sync_records; exception when duplicate_object then null; end $$;
