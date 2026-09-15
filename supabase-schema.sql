-- GTP Nexus production schema. Run in Supabase: SQL Editor > New query.
-- Do not insert passwords here. Supabase Auth owns password storage and hashing.

create extension if not exists pgcrypto;
create type public.gtp_role as enum ('admin','manager','staff','attendance_kiosk');
create type public.gtp_status as enum ('active','suspended','invited');

create sequence public.gtp_staff_sequence start 1;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  staff_code text not null unique,
  full_name text not null,
  email text not null unique,
  department text,
  job_title text,
  role public.gtp_role not null default 'staff',
  status public.gtp_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_badges (
  id uuid primary key,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  active boolean not null default true,
  issued_by uuid references public.profiles(id),
  issued_at timestamptz not null default now()
);
create index staff_badges_staff_active_idx on public.staff_badges(staff_id, active);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete restrict,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  clock_in_by uuid references public.profiles(id),
  clock_out_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint clock_out_after_clock_in check (clock_out is null or clock_out >= clock_in)
);
create index attendance_staff_time_idx on public.attendance(staff_id, clock_in desc);

create table public.staff_documents (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete cascade,
  document_name text not null,
  document_type text not null,
  storage_path text,
  expiry_date date,
  status text not null default 'recorded',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();

-- Security-definer helpers avoid recursive RLS checks. They return only a boolean.
create or replace function public.is_gtp_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;
create or replace function public.can_run_attendance_kiosk()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','attendance_kiosk') and status = 'active');
$$;
create or replace function public.next_staff_sequence()
returns bigint language sql security definer set search_path = public as $$ select nextval('public.gtp_staff_sequence'); $$;

revoke all on function public.next_staff_sequence() from public, anon, authenticated;
grant execute on function public.next_staff_sequence() to service_role;

alter table public.profiles enable row level security;
alter table public.staff_badges enable row level security;
alter table public.attendance enable row level security;
alter table public.staff_documents enable row level security;

-- Browser access: users never read raw badge hashes or write attendance directly.
revoke all on table public.profiles, public.staff_badges, public.attendance, public.staff_documents from anon, authenticated;
grant select on table public.profiles, public.attendance, public.staff_documents to authenticated;
create policy "staff view own profile or admin directory" on public.profiles for select using (id = auth.uid() or public.is_gtp_admin());
create policy "admins manage profile records" on public.profiles for all using (public.is_gtp_admin()) with check (public.is_gtp_admin());
create policy "staff view own attendance" on public.attendance for select using (staff_id = auth.uid() or public.can_run_attendance_kiosk());
create policy "staff view own documents" on public.staff_documents for select using (staff_id = auth.uid() or public.is_gtp_admin());
create policy "admins manage documents" on public.staff_documents for all using (public.is_gtp_admin()) with check (public.is_gtp_admin());

-- First administrator: create their Auth user in Supabase Authentication > Users,
-- copy the user's UUID, then replace these values and run this one statement once:
-- insert into public.profiles (id,staff_code,full_name,email,department,job_title,role,status)
-- values ('AUTH-USER-UUID','ab962143-9c34-408b-8138-edc883923fe4','GTP GLOBA','snduka20@gmail.com','Administration','System Administrator','admin','active');
-- select setval('public.gtp_staff_sequence', 1, true);
