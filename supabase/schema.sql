-- Glitch Detective database. Run once in the Supabase SQL editor.
-- Only the server (service role key) reads and writes. RLS is on with no policies, so the public
-- anon key in the browser can't see any row: not cases, not hints, not solutions, not usage.

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  error text not null,
  code text not null default '',
  analysis jsonb not null,
  concept text not null,
  language text not null,
  status text not null default 'new' check (status in ('new', 'training', 'solved')),
  passed_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cases_user_created on public.cases (user_id, created_at desc);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  broken_code text not null,
  symptom text not null,
  language text not null,
  hints jsonb not null,
  hints_revealed int not null default 0,
  status text not null default 'open' check (status in ('open', 'passed')),
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
create index challenges_case_open on public.challenges (user_id, case_id, status);

create table public.challenge_secrets (
  challenge_id uuid primary key references public.challenges (id) on delete cascade,
  solution text not null,
  bug_explanation text not null
);

create table public.usage (
  key text not null,
  day date not null,
  calls int not null default 0,
  primary key (key, day)
);

alter table public.cases enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_secrets enable row level security;
alter table public.usage enable row level security;

-- No policies at all: the browser never queries these tables (everything goes through /api),
-- and a select policy on challenges would expose hints the student hasn't unlocked yet.
-- Only the service role, used by the API, can read or write.

-- Atomic +1 for the daily AI limit.
create or replace function public.increment_usage(p_key text, p_day date)
returns int
language sql
security definer
set search_path = public
as $$
  insert into public.usage (key, day, calls) values (p_key, p_day, 1)
  on conflict (key, day) do update set calls = public.usage.calls + 1
  returning calls;
$$;
revoke execute on function public.increment_usage(text, date) from public, anon, authenticated;
