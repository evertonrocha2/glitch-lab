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
-- Handles are stored lowercase, so lookups use a plain equality and need this index.
create index if not exists users_handle on public.users (handle);

-- Community articles: anyone can read them through /api/community; only the server writes.
-- Like everything else, RLS is on with no policies, so the browser can't touch these tables directly.
-- "if not exists" so this block also upgrades a database made before the community existed.
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 12000),
  tags text[] not null default '{}' check (cardinality(tags) <= 5),
  -- Optional link to one of the author's cases: only its error type, bug type and language are shown.
  case_id uuid references public.cases (id) on delete set null,
  -- Kept up to date by refresh_article_counts, so lists can sort by them.
  like_count int not null default 0,
  valid_count int not null default 0,
  bad_count int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists articles_created on public.articles (created_at desc);
create index if not exists articles_author on public.articles (author_id, created_at desc);
create index if not exists articles_tags on public.articles using gin (tags);

create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  author_id uuid not null references public.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists article_comments_article on public.article_comments (article_id, created_at);
create index if not exists article_comments_author on public.article_comments (author_id);

-- One row per person and article: a like and/or a rating. author_id is the article's author, copied
-- here so "what did my articles receive" is a single count. Demo reactions show but earn no XP.
create table if not exists public.article_reactions (
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  author_id uuid not null references public.users (id) on delete cascade,
  liked boolean not null default false,
  rating text check (rating in ('valid', 'bad')),
  from_demo boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (article_id, user_id)
);
create index if not exists article_reactions_author on public.article_reactions (author_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('comment', 'like', 'rating_valid', 'rating_bad')),
  actor_id uuid not null references public.users (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications (user_id, created_at desc);

alter table public.articles enable row level security;
alter table public.article_comments enable row level security;
alter table public.article_reactions enable row level security;
alter table public.notifications enable row level security;

-- Recounts likes, ratings and comments on one article after any change to them.
create or replace function public.refresh_article_counts(p_article uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.articles a set
    like_count = (select count(*) from public.article_reactions r where r.article_id = a.id and r.liked),
    valid_count = (select count(*) from public.article_reactions r where r.article_id = a.id and r.rating = 'valid'),
    bad_count = (select count(*) from public.article_reactions r where r.article_id = a.id and r.rating = 'bad'),
    comment_count = (select count(*) from public.article_comments c where c.article_id = a.id)
  where a.id = p_article;
$$;
revoke execute on function public.refresh_article_counts(uuid) from public, anon, authenticated;
