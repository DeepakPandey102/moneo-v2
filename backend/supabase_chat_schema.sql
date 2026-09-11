-- Moneo 2.0 — "Ask Anything" chat schema
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run
-- (This is IN ADDITION to your existing user_data table — doesn't touch it)

-- One row per chat thread (like a ChatGPT conversation in the sidebar)
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Chat',
  -- Holds a compressed summary of older messages once a thread gets long,
  -- so the AI can "remember" earlier context without resending the whole
  -- conversation every single message.
  memory_summary text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per message within a thread
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

-- Users can only ever see/edit their own threads
create policy "Users can view their own threads"
  on public.chat_threads for select using (auth.uid() = user_id);
create policy "Users can create their own threads"
  on public.chat_threads for insert with check (auth.uid() = user_id);
create policy "Users can update their own threads"
  on public.chat_threads for update using (auth.uid() = user_id);
create policy "Users can delete their own threads"
  on public.chat_threads for delete using (auth.uid() = user_id);

-- Messages are only visible if you own the thread they belong to
create policy "Users can view messages in their own threads"
  on public.chat_messages for select
  using (exists (select 1 from public.chat_threads where id = thread_id and user_id = auth.uid()));
create policy "Users can add messages to their own threads"
  on public.chat_messages for insert
  with check (exists (select 1 from public.chat_threads where id = thread_id and user_id = auth.uid()));
create policy "Users can delete messages in their own threads"
  on public.chat_messages for delete
  using (exists (select 1 from public.chat_threads where id = thread_id and user_id = auth.uid()));

-- Keep updated_at accurate whenever a thread is touched
create or replace function public.set_thread_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_chat_thread_updated_at
  before update on public.chat_threads
  for each row execute function public.set_thread_updated_at();
