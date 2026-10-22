-- Glitch Detective database. Run once in the Supabase SQL editor.
-- Only the server (service role key) reads and writes. RLS is on with no policies, so the public
-- anon key in the browser can't see any row: not cases, not hints, not solutions, not usage.

-- Accounts live here (the app does its own email + password auth; Supabase is only the database).
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  error text not null,
  code text not null default '',
  -- Files the student attached: [{ path, content }], already cut down to the lines that matter.
  files jsonb not null default '[]',
  context text not null default '',
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
  user_id uuid not null references public.users (id) on delete cascade,
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

-- A note is a list of blocks: text, heading, todo, or a case from the board.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null default '',
  blocks jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_user_updated on public.notes (user_id, updated_at desc);

-- Seconds studied per day, from the timer. The day is the student's local date.
create table public.study_time (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null,
  seconds int not null default 0,
  primary key (user_id, day)
);

create table public.usage (
  key text not null,
  day date not null,
  calls int not null default 0,
  primary key (key, day)
);

alter table public.users enable row level security;
alter table public.cases enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_secrets enable row level security;
alter table public.usage enable row level security;
alter table public.notes enable row level security;
alter table public.study_time enable row level security;

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

-- Atomic add for the study timer, never past the daily cap.
create or replace function public.add_study_time(p_user uuid, p_day date, p_seconds int, p_max int)
returns int
language sql
security definer
set search_path = public
as $$
  insert into public.study_time (user_id, day, seconds) values (p_user, p_day, least(p_seconds, p_max))
  on conflict (user_id, day) do update set seconds = least(public.study_time.seconds + p_seconds, p_max)
  returning seconds;
$$;
revoke execute on function public.add_study_time(uuid, date, int, int) from public, anon, authenticated;

-- Profiles: a handle, name, bio, pixel avatar and featured badges, all on the account row.
-- "add column if not exists" so this block also upgrades a database made before profiles existed.
-- Handles are saved lowercase; the index on lower(handle) keeps them unique whatever the case.
alter table public.users add column if not exists handle text check (handle ~ '^[a-z0-9_-]{3,20}$');
alter table public.users add column if not exists display_name text check (char_length(display_name) <= 40);
alter table public.users add column if not exists bio text not null default '' check (char_length(bio) <= 160);
alter table public.users add column if not exists avatar jsonb;
alter table public.users add column if not exists featured_badges jsonb not null default '[]';
alter table public.users add column if not exists is_public boolean not null default false;
create unique index if not exists users_handle_unique on public.users (lower(handle));
