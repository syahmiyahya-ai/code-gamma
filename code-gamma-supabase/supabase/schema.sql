-- Code Gamma Supabase schema (PostgreSQL)

create extension if not exists pgcrypto;

create type public.user_role as enum ('Staff', 'Supervisor', 'RosterAdmin', 'Admin', 'SystemAdmin');
create type public.swap_status as enum ('PENDING', 'ACCEPTED', 'APPROVED', 'REJECTED', 'CANCELLED');
create type public.task_status as enum ('PENDING', 'COMPLETED');

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role public.user_role not null default 'Staff',
  phone_number text,
  email text,
  avatar_url text,
  google_access_token text,
  google_refresh_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shift_types (
  code text primary key,
  name text not null,
  start_time text,
  end_time text,
  description text,
  background_color text not null,
  text_color text not null
);

create table if not exists public.shifts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  shift_code text not null references public.shift_types(code),
  is_code_blue boolean not null default false,
  unique (user_id, date)
);

create table if not exists public.shift_audit_logs (
  id bigint generated always as identity primary key,
  shift_id bigint,
  action text not null,
  changed_by uuid references public.users(id),
  old_data jsonb,
  new_data jsonb,
  timestamp timestamptz not null default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references public.users(id),
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id bigint generated always as identity primary key,
  title text not null,
  content text not null,
  author_id uuid references public.users(id) on delete set null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id bigint generated always as identity primary key,
  title text not null,
  category text not null,
  file_url text not null,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.leave_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  related_entity_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.owed_days (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  reason text,
  date_earned date not null,
  date_redeemed date,
  status text not null default 'OWED'
);

create table if not exists public.tasks (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  due_date timestamptz,
  created_by uuid not null references public.users(id),
  is_edited boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.task_assignments (
  id bigint generated always as identity primary key,
  task_id bigint not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status public.task_status not null default 'PENDING',
  completed_at timestamptz
);

create table if not exists public.shift_swaps (
  id bigint generated always as identity primary key,
  requester_id uuid not null references public.users(id),
  requester_shift_id bigint not null references public.shifts(id) on delete cascade,
  target_user_id uuid references public.users(id),
  target_shift_id bigint references public.shifts(id),
  status public.swap_status not null default 'PENDING',
  reason text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.shift_types enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_swaps enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.documents enable row level security;
alter table public.leave_requests enable row level security;
alter table public.owed_days enable row level security;
alter table public.audit_events enable row level security;
alter table public.shift_audit_logs enable row level security;

create policy "users can read own profile" on public.users
  for select using (auth.uid() = id);

create policy "admins can read all users" on public.users
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('Admin', 'SystemAdmin', 'RosterAdmin'))
  );

create policy "users update own profile (except role)" on public.users
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.users where id = auth.uid()));

create policy "admins manage users" on public.users
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('Admin', 'SystemAdmin'))
  );
