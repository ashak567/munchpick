-- Create user_assets table
create table if not exists public.user_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  hero_mobile_path text,
  hero_desktop_path text,
  mascot_base_path text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS on user_assets table
alter table public.user_assets enable row level security;

-- RLS policies for user_assets
create policy "Users can view their own assets record"
on public.user_assets for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert their own assets record"
on public.user_assets for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their own assets record"
on public.user_assets for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their own assets record"
on public.user_assets for delete
to authenticated
using (user_id = auth.uid());

-- Create private storage buckets
insert into storage.buckets (id, name, public) 
values ('user-videos', 'user-videos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public) 
values ('user-mascots', 'user-mascots', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public) 
values ('user-textures', 'user-textures', false)
on conflict (id) do nothing;

-- RLS policies for user-videos bucket
create policy "Users can select their own videos"
on storage.objects for select
to authenticated
using (bucket_id = 'user-videos' and split_part(name, '/', 1) = auth.uid()::text);

create policy "Users can insert their own videos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'user-videos' and split_part(name, '/', 1) = auth.uid()::text);

create policy "Users can update their own videos"
on storage.objects for update
to authenticated
using (bucket_id = 'user-videos' and split_part(name, '/', 1) = auth.uid()::text)
with check (bucket_id = 'user-videos' and split_part(name, '/', 1) = auth.uid()::text);

create policy "Users can delete their own videos"
on storage.objects for delete
to authenticated
using (bucket_id = 'user-videos' and split_part(name, '/', 1) = auth.uid()::text);

-- RLS policies for user-mascots bucket
create policy "Users can select their own mascots"
on storage.objects for select
to authenticated
using (bucket_id = 'user-mascots' and split_part(name, '/', 1) = auth.uid()::text);

create policy "Users can insert their own mascots"
on storage.objects for insert
to authenticated
with check (bucket_id = 'user-mascots' and split_part(name, '/', 1) = auth.uid()::text);

create policy "Users can update their own mascots"
on storage.objects for update
to authenticated
using (bucket_id = 'user-mascots' and split_part(name, '/', 1) = auth.uid()::text)
with check (bucket_id = 'user-mascots' and split_part(name, '/', 1) = auth.uid()::text);

create policy "Users can delete their own mascots"
on storage.objects for delete
to authenticated
using (bucket_id = 'user-mascots' and split_part(name, '/', 1) = auth.uid()::text);

-- RLS policies for user-textures bucket
create policy "Users can select their own textures"
on storage.objects for select
to authenticated
using (bucket_id = 'user-textures' and split_part(name, '/', 1) = auth.uid()::text);

create policy "Users can insert their own textures"
on storage.objects for insert
to authenticated
with check (bucket_id = 'user-textures' and split_part(name, '/', 1) = auth.uid()::text);

create policy "Users can update their own textures"
on storage.objects for update
to authenticated
using (bucket_id = 'user-textures' and split_part(name, '/', 1) = auth.uid()::text)
with check (bucket_id = 'user-textures' and split_part(name, '/', 1) = auth.uid()::text);

create policy "Users can delete their own textures"
on storage.objects for delete
to authenticated
using (bucket_id = 'user-textures' and split_part(name, '/', 1) = auth.uid()::text);
