-- Moneo 2.0 — Supabase schema
-- Run this once in Supabase: left sidebar -> SQL Editor -> New query -> paste all of this -> Run

-- One row per user, holding their full app data as JSON. This mirrors the
-- exact same {transactions, budgets, goals, notes, achievements, settings}
-- shape the app already used with localStorage, so the rest of the app's
-- logic (calculations, pages) didn't need to change — only how data gets
-- loaded and saved changed.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{
    "transactions": [],
    "budgets": [],
    "goals": [],
    "notes": [],
    "achievements": [],
    "settings": {"language": "en", "assistantMode": "api"}
  }'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: this is what makes it actually safe to call Supabase
-- directly from the browser with the public "anon" key. Without this, any
-- logged-in user could read or overwrite anyone else's data.
alter table public.user_data enable row level security;

-- A user can only ever see their own row...
create policy "Users can view their own data"
  on public.user_data for select
  using (auth.uid() = user_id);

-- ...and can only ever insert a row for themselves...
create policy "Users can insert their own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

-- ...and can only ever update their own row.
create policy "Users can update their own data"
  on public.user_data for update
  using (auth.uid() = user_id);

-- Automatically create an empty data row the moment someone finishes
-- signing up, so the app never has to handle "no row yet" as a special
-- case in the frontend.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_data (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at accurate on every save.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_user_data_updated_at
  before update on public.user_data
  for each row execute function public.set_updated_at();
