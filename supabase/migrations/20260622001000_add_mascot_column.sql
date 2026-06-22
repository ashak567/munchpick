-- Alter decisions table to add mascot column
alter table public.decisions 
  add column if not exists mascot text default 'munch';
