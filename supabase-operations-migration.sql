-- GTP Nexus operations module migration.
-- Run this AFTER supabase-schema.sql in the Supabase SQL Editor.

create sequence if not exists public.gtp_job_sequence start 1;

create table if not exists public.service_lines (
  id smallint primary key,
  name text not null unique,
  description text not null
);
insert into public.service_lines (id,name,description) values
 (1,'Onshore & Offshore Fabrication','Structural steel fabrication for platforms, decks, walkways, supports and small steelwork.'),
 (2,'Flowline, Manifold & Piping Systems','Fabrication and installation of flowlines, manifolds and process piping.'),
 (3,'Tank Fabrication, Repair & Modification','New-build storage/process tanks plus repair and modification work.'),
 (4,'Ship & Marine Repair','Structural, piping and mechanical repairs on vessels, barges and workboats.'),
 (5,'Corrosion Control, Blasting & Painting','Surface preparation and coating systems matched to asset exposure conditions.'),
 (6,'Offshore Construction, Rig Support & Turnaround Services','Rig start-up, offshore structural work and shutdown/turnaround support.'),
 (7,'Welding & Certified Manpower Supply','Welding services and certified tradespeople supply.'),
 (8,'Engineering, Project Management & QA/QC','Planning, coordination, inspection, testing and quality records.'),
 (9,'Procurement & Certified Materials Supply','Sourcing of pipes, fittings, consumables and certified steel materials.'),
 (10,'EPC & Integrated Project Services','Integrated engineering, procurement and construction delivery.')
on conflict (id) do update set name=excluded.name, description=excluded.description;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_code text not null unique,
  title text not null,
  client_name text not null,
  service_line_id smallint not null references public.service_lines(id),
  status text not null default 'planned' check (status in ('planned','production','quality_review','ready_for_dispatch','completed','delayed')),
  progress integer not null default 0 check (progress between 0 and 100),
  start_date date,
  due_date date,
  contract_value numeric(16,2) not null default 0 check (contract_value >= 0),
  project_note text,
  manager_id uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_status_due_idx on public.jobs(status,due_date);
create index if not exists jobs_manager_idx on public.jobs(manager_id);

create table if not exists public.job_assignments (
  job_id uuid not null references public.jobs(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key(job_id,staff_id)
);

create table if not exists public.job_updates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  message text not null,
  progress integer check (progress between 0 and 100),
  status text check (status in ('planned','production','quality_review','ready_for_dispatch','completed','delayed')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists job_updates_job_time_idx on public.job_updates(job_id,created_at desc);

create table if not exists public.procurement_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  item_name text not null,
  quantity text,
  status text not null default 'requested' check (status in ('requested','sourcing','ordered','received','delayed')),
  supplier text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.quality_records (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  record_name text not null,
  status text not null default 'open' check (status in ('open','accepted','rejected','on_hold')),
  inspection_date date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.touch_job_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists jobs_touch_updated_at on public.jobs;
create trigger jobs_touch_updated_at before update on public.jobs for each row execute function public.touch_job_updated_at();

create or replace function public.can_manage_operations()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id=auth.uid() and role in ('admin','manager') and status='active');
$$;
create or replace function public.is_assigned_to_job(target_job uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.job_assignments where job_id=target_job and staff_id=auth.uid());
$$;
create or replace function public.next_job_sequence()
returns bigint language sql security definer set search_path = public as $$ select nextval('public.gtp_job_sequence'); $$;
revoke all on function public.next_job_sequence() from public, anon, authenticated;
grant execute on function public.next_job_sequence() to service_role;

alter table public.service_lines enable row level security;
alter table public.jobs enable row level security;
alter table public.job_assignments enable row level security;
alter table public.job_updates enable row level security;
alter table public.procurement_items enable row level security;
alter table public.quality_records enable row level security;
revoke all on table public.service_lines,public.jobs,public.job_assignments,public.job_updates,public.procurement_items,public.quality_records from anon,authenticated;
grant select on table public.service_lines,public.jobs,public.job_assignments,public.job_updates,public.procurement_items,public.quality_records to authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.service_lines,public.jobs,public.job_assignments,public.job_updates,public.procurement_items,public.quality_records to service_role;

create policy "authenticated staff view service lines" on public.service_lines for select using (auth.uid() is not null);
create policy "operations managers view all jobs" on public.jobs for select using (public.can_manage_operations() or public.is_assigned_to_job(id));
create policy "operations managers view assignments" on public.job_assignments for select using (public.can_manage_operations() or staff_id=auth.uid());
create policy "operations managers view job updates" on public.job_updates for select using (public.can_manage_operations() or public.is_assigned_to_job(job_id));
create policy "operations managers view procurement" on public.procurement_items for select using (public.can_manage_operations() or public.is_assigned_to_job(job_id));
create policy "operations managers view quality" on public.quality_records for select using (public.can_manage_operations() or public.is_assigned_to_job(job_id));

-- First job created by an admin/manager will receive job code GTP-YY-00001.
