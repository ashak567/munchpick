-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Create users table
create table public.users (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null unique,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Create decisions table
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users on delete cascade,
  category text not null default 'Other',
  selected_option text not null,
  reinforcement_message text not null,
  created_at timestamptz not null default now()
);

-- 3. Create options table
create table public.options (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions on delete cascade,
  option_text text not null,
  is_selected boolean not null default false,
  weight numeric not null default 1.0,
  tags text[],
  created_at timestamptz not null default now()
);

-- 4. Create feedback table
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null unique references public.decisions on delete cascade,
  rating text not null check (rating in ('love', 'okay', 'meh')),
  created_at timestamptz not null default now()
);

-- 5. Create preferences table
create table public.preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users on delete cascade,
  category text not null,
  tag text not null,
  score numeric not null default 0.0 check (score >= -10.0 and score <= 10.0),
  updated_at timestamptz not null default now(),
  unique (user_id, category, tag)
);

-- Set up timestamps auto-update function & triggers
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_user_updated
  before update on public.users
  for each row execute procedure public.handle_updated_at();

create trigger on_preference_updated
  before update on public.preferences
  for each row execute procedure public.handle_updated_at();

-- Set up sync function & trigger from auth.users to public.users
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.users (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set name = excluded.name,
      avatar_url = excluded.avatar_url,
      updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable Row Level Security (RLS) on all tables
alter table public.users enable row level security;
alter table public.decisions enable row level security;
alter table public.options enable row level security;
alter table public.feedback enable row level security;
alter table public.preferences enable row level security;

-- Create RLS Policies
-- users policies
create policy "Users can read own profile" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- decisions policies
create policy "Users can manage own decisions" on public.decisions
  for all using (auth.uid() = user_id);

-- options policies
create policy "Users can manage options of own decisions" on public.options
  for all using (
    exists (
      select 1 from public.decisions d
      where d.id = decision_id and d.user_id = auth.uid()
    )
  );

-- feedback policies
create policy "Users can manage feedback of own decisions" on public.feedback
  for all using (
    exists (
      select 1 from public.decisions d
      where d.id = decision_id and d.user_id = auth.uid()
    )
  );

-- preferences policies
create policy "Users can manage own preferences" on public.preferences
  for all using (auth.uid() = user_id);
