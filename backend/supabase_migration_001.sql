-- Moneo 2.0 — migration 001 (run once, after the two existing schema files)
-- Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.

-- 1) Ask Anything memory: remember how many old messages are already folded
--    into memory_summary, so each reply only summarizes NEW messages instead
--    of re-summarizing the whole history every time.
alter table public.chat_threads
  add column if not exists summarized_count integer not null default 0;

-- 2) Update policy for user_data: also check the NEW row, so a user can't
--    change a row's user_id to someone else's.
drop policy if exists "Users can update their own data" on public.user_data;
create policy "Users can update their own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3) Same for chat threads.
drop policy if exists "Users can update their own threads" on public.chat_threads;
create policy "Users can update their own threads"
  on public.chat_threads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4) Signup trigger: pin search_path (Supabase security advisor warning) and
--    don't fail signup if the row somehow already exists.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_data (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 5) Backfill: create a data row for any account made before the trigger existed.
insert into public.user_data (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- 6) Faster thread/message listing as history grows.
create index if not exists chat_threads_user_updated_idx on public.chat_threads (user_id, updated_at desc);
create index if not exists chat_messages_thread_created_idx on public.chat_messages (thread_id, created_at);
