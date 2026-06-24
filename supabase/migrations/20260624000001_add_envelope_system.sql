-- Create envelope letter type enum
create type public.envelope_letter_type as enum ('signup', 'daily_return', 'inactivity', 'milestone');

-- Create envelope letters table
create table public.envelope_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  letter_type public.envelope_letter_type not null,
  milestone_key text default null,
  content text not null,
  mascot_character_used text not null,
  mascot_expression text not null default 'idle',
  scene_used text not null default 'default',
  presentation_type text not null default 'envelope',
  relationship_level_snapshot text not null,
  nickname_snapshot text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add updated_at trigger
create trigger on_envelope_letters_updated
  before update on public.envelope_letters
  for each row execute procedure public.handle_updated_at();

-- Enable RLS
alter table public.envelope_letters enable row level security;

-- RLS policies
create policy "Users can manage own envelope letters" on public.envelope_letters
  for all using (auth.uid() = user_id);

-- Add optimized indexes for lookups
create index idx_envelope_letters_lookup on public.envelope_letters (user_id, created_at desc);
create index idx_envelope_letters_milestones on public.envelope_letters (user_id, milestone_key);

-- Add last_active_at to users table if not exists
alter table public.users add column if not exists last_active_at timestamptz not null default now();
