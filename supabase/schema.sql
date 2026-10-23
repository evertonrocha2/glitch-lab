-- Glitch Lab database. Run once in the Supabase SQL editor.
-- Only the server (service role key) reads and writes. RLS is on with no policies, so the public
-- anon key in the browser can't see any row: not cases, not hints, not solutions, not usage.

-- Accounts live here (the app does its own email + password auth; Supabase is only the database).
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.cases (
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
create index if not exists cases_user_created on public.cases (user_id, created_at desc);

create table if not exists public.challenges (
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
create index if not exists challenges_case_open on public.challenges (user_id, case_id, status);

create table if not exists public.challenge_secrets (
  challenge_id uuid primary key references public.challenges (id) on delete cascade,
  solution text not null,
  bug_explanation text not null
);

-- A note is a list of blocks: text, heading, todo, or a case from the board.
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null default '',
  blocks jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_user_updated on public.notes (user_id, updated_at desc);

-- Seconds studied per day, from the timer. The day is the student's local date.
create table if not exists public.study_time (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null,
  seconds int not null default 0,
  primary key (user_id, day)
);

create table if not exists public.usage (
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

-- "About you" on the profile, and notes shared on it. Same "if not exists" upgrade style.
-- The API checks every value (fixed lists for role, languages and open_to; https links); the
-- checks here only cap sizes. A note is shown to others only when it AND its owner's profile are public.
alter table public.users add column if not exists role text check (role in ('student', 'developer', 'career-changer', 'teacher', 'other'));
alter table public.users add column if not exists headline text not null default '' check (char_length(headline) <= 80);
alter table public.users add column if not exists university text not null default '' check (char_length(university) <= 80);
alter table public.users add column if not exists course text not null default '' check (char_length(course) <= 80);
alter table public.users add column if not exists work text not null default '' check (char_length(work) <= 80);
alter table public.users add column if not exists location text not null default '' check (char_length(location) <= 60);
alter table public.users add column if not exists languages jsonb not null default '[]';
alter table public.users add column if not exists links jsonb not null default '{}';
alter table public.users add column if not exists open_to jsonb not null default '[]';
alter table public.notes add column if not exists is_public boolean not null default false;
create index if not exists notes_user_public on public.notes (user_id) where is_public;

-- Study trails: AI-built missions from the student's own cases and notes. "if not exists" so this block
-- also upgrades an older database. Only hand-ticked reflect missions are stored in done; the rest is
-- worked out from cases, challenges, notes and study time.
create table if not exists public.trails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  summary text not null default '',
  missions jsonb not null default '[]',
  done jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists trails_user_created on public.trails (user_id, created_at desc);
alter table public.trails enable row level security;

-- Daily and global challenges: the same puzzles for everyone. The cron (or the curated pool, as a
-- fallback) writes 3 dailies a day (easy, medium, hard) and one global a week (day = its Monday).
-- The unique slot makes writing a day twice a no-op. Solutions sit in puzzle_secrets, like
-- challenge_secrets, and never reach the browser.
create table if not exists public.puzzles (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('daily', 'global')),
  day date not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  language text not null,
  concept text not null,
  title text not null,
  broken_code text not null,
  symptom text not null,
  hints jsonb not null,
  created_at timestamptz not null default now(),
  unique (kind, day, difficulty)
);

create table if not exists public.puzzle_secrets (
  puzzle_id uuid primary key references public.puzzles (id) on delete cascade,
  solution text not null,
  bug_explanation text not null
);

-- A puzzle attempt is a gym challenge with a puzzle instead of a case: one per user per puzzle.
-- passed_at times the first pass for the leaderboard.
alter table public.challenges alter column case_id drop not null;
alter table public.challenges add column if not exists puzzle_id uuid references public.puzzles (id) on delete cascade;
alter table public.challenges add column if not exists passed_at timestamptz;
create unique index if not exists challenges_user_puzzle on public.challenges (user_id, puzzle_id) where puzzle_id is not null;
create index if not exists challenges_puzzle_status on public.challenges (puzzle_id, status) where puzzle_id is not null;

-- Everyone gets the same puzzle, so it keeps a Brazilian Portuguese copy next to the English text:
-- puzzles.pt is { title, symptom, hints }, puzzle_secrets.pt is { bugExplanation }. Null on puzzles
-- saved before this, which the app reads in English (or from the pool's translation).
alter table public.puzzles add column if not exists pt jsonb;
alter table public.puzzle_secrets add column if not exists pt jsonb;

alter table public.puzzles enable row level security;
alter table public.puzzle_secrets enable row level security;

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

-- Glitchdle: a riddle a day per board, the same for everyone: the language in three modes
-- (classic, error, snippet), a framework and a database. The cron (or the first player of a day it
-- missed) writes one row per day and mode; the unique slot makes writing a day twice a no-op.
-- `answer` is an item id from shared/riddle/languages.js or shared/riddle/catalogs/*.js and never
-- leaves the server before a player solves the board. `payload` holds what the mode shows (the
-- error message, or the snippet and its reveal order).
create table if not exists public.riddles (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  mode text not null check (mode in ('classic', 'error', 'snippet', 'frameworks', 'databases')),
  answer text not null,
  payload jsonb not null default '{}',
  source text not null default 'dataset' check (source in ('dataset', 'ai')),
  created_at timestamptz not null default now(),
  unique (day, mode)
);

-- One row per player, day and mode: the item ids guessed, in order. guess_count mirrors the
-- list's length so a guess is saved only if no other guess landed in between.
create table if not exists public.riddle_results (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null,
  mode text not null check (mode in ('classic', 'error', 'snippet', 'frameworks', 'databases')),
  guesses jsonb not null default '[]',
  guess_count int not null default 0 check (guess_count between 0 and 30),
  solved boolean not null default false,
  solved_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, day, mode)
);
create index if not exists riddle_results_day on public.riddle_results (day, mode);

-- Databases made before the framework and database boards: widen the mode checks. Postgres named
-- the inline checks <table>_mode_check; dropping first makes this safe to run again.
alter table public.riddles drop constraint if exists riddles_mode_check;
alter table public.riddles add constraint riddles_mode_check check (mode in ('classic', 'error', 'snippet', 'frameworks', 'databases'));
alter table public.riddle_results drop constraint if exists riddle_results_mode_check;
alter table public.riddle_results add constraint riddle_results_mode_check check (mode in ('classic', 'error', 'snippet', 'frameworks', 'databases'));

alter table public.riddles enable row level security;
alter table public.riddle_results enable row level security;

-- Duel: a 1v1 quiz race (5 rounds, the fastest right answer scores more). One row per duel.
-- `rounds` holds each question with its answer and `bot_plan` the Glitch Bot's answers: both stay on
-- the server, and the API only shows a round's answer once that round is over. `players` is
-- [{ userId, isDemo, bot, joinedAt, seenAt }] and `player_ids` the same ids as a searchable list
-- ('bot' for the Glitch Bot). `answers` and `focus` (tab leave events) carry server times. Every write
-- checks `version`, so two answers landing together never overwrite each other.
create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('private', 'queue', 'bot')),
  status text not null check (status in ('waiting', 'active', 'finished', 'cancelled')),
  players jsonb not null default '[]',
  player_ids text[] not null default '{}',
  start_at timestamptz,
  finished_at timestamptz,
  rounds jsonb not null default '[]',
  bot_plan jsonb,
  answers jsonb not null default '[]',
  focus jsonb not null default '[]',
  result jsonb,
  rematch_of uuid,
  rematch_id uuid,
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists duels_player_ids on public.duels using gin (player_ids);
create index if not exists duels_queue on public.duels (kind, status, updated_at);

-- One Elo rating per player (starts at 1000), changed only by finished duels between two people
-- (never the bot, never a demo account). `games` is the version check for each write.
create table if not exists public.duel_ratings (
  user_id uuid primary key references public.users (id) on delete cascade,
  rating int not null default 1000,
  games int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists duel_ratings_rating on public.duel_ratings (rating desc);

alter table public.duels enable row level security;
alter table public.duel_ratings enable row level security;

-- Community events: hackathons, backend battles ("rinhas"), challenges and study groups. Anyone can
-- read them through /api/community; only the server writes. Status comes from the dates: upcoming
-- before starts_at, live until ends_at, voting until closes_at (moved sooner when winners are announced).
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  summary text not null check (char_length(summary) between 1 and 200),
  description text not null check (char_length(description) between 1 and 6000),
  rules text not null default '' check (char_length(rules) <= 6000),
  prizes text not null default '' check (char_length(prizes) <= 1000),
  kind text not null check (kind in ('hackathon', 'battle', 'challenge', 'study-group')),
  tags text[] not null default '{}' check (cardinality(tags) <= 5),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  closes_at timestamptz not null,
  -- What an entry must link to: { repo, video, demo }, each 'required', 'optional' or 'off'.
  requirements jsonb not null default '{"repo": "required", "video": "optional", "demo": "optional"}',
  announced_at timestamptz,
  -- Kept up to date by refresh_event_entry_count.
  entry_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists events_starts on public.events (starts_at);
create index if not exists events_closes on public.events (closes_at desc);
create index if not exists events_organizer on public.events (organizer_id);
create index if not exists events_tags on public.events using gin (tags);

-- One entry per person and event. place is 1 to 3 once the organizer picks the winners.
create table if not exists public.event_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  repo_url text check (char_length(repo_url) <= 300),
  video_url text check (char_length(video_url) <= 300),
  demo_url text check (char_length(demo_url) <= 300),
  vote_count int not null default 0,
  place int check (place between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index if not exists event_entries_user on public.event_entries (user_id, created_at);

-- One vote per person and entry. event_id and author_id (the entry's author) are copied here so
-- "my votes in this event" and "votes I received" are single lookups.
create table if not exists public.event_votes (
  entry_id uuid not null references public.event_entries (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  author_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);
create index if not exists event_votes_event_user on public.event_votes (event_id, user_id);
create index if not exists event_votes_author on public.event_votes (author_id);

alter table public.events enable row level security;
alter table public.event_entries enable row level security;
alter table public.event_votes enable row level security;

create or replace function public.refresh_event_entry_count(p_event uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.events e set entry_count = (select count(*) from public.event_entries x where x.event_id = e.id)
  where e.id = p_event;
$$;
revoke execute on function public.refresh_event_entry_count(uuid) from public, anon, authenticated;

create or replace function public.refresh_entry_vote_count(p_entry uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.event_entries x set vote_count = (select count(*) from public.event_votes v where v.entry_id = x.id)
  where x.id = p_entry;
$$;
revoke execute on function public.refresh_entry_vote_count(uuid) from public, anon, authenticated;

-- Event notifications reuse the bell: they point at an event instead of an article.
alter table public.notifications alter column article_id drop not null;
alter table public.notifications add column if not exists event_id uuid references public.events (id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('comment', 'like', 'rating_valid', 'rating_bad', 'event_join', 'event_vote', 'event_winner'));
create index if not exists notifications_event on public.notifications (event_id) where event_id is not null;

-- Interrogation: a guided debugging session on one case (reproduce, read the error, hypothesis,
-- isolate, fix, prevent). One row per student and case. `turns` is every graded answer
-- [{ step, answer, feedback, question, passed, at }] and `step` the step the student is on (6 when
-- done). Every write checks `turn_count`, so two answers landing together never overwrite each other.
create table if not exists public.interrogations (
  user_id uuid not null references public.users (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  step int not null default 0 check (step between 0 and 6),
  turns jsonb not null default '[]',
  turn_count int not null default 0 check (turn_count between 0 and 60),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, case_id)
);
create index if not exists interrogations_user_updated on public.interrogations (user_id, updated_at desc);

alter table public.interrogations enable row level security;

-- Spaced review (Leitner boxes). One row per student and bug concept: the box it sits in (1 to 5)
-- and the day it's due again. A right answer moves it up a box, a wrong one back to box 1.
create table if not exists public.review_items (
  user_id uuid not null references public.users (id) on delete cascade,
  concept text not null,
  box int not null default 1 check (box between 1 and 5),
  due_day date not null,
  last_day date,
  right_count int not null default 0,
  wrong_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, concept)
);

-- One row per student and day: the open review session (its cards with their answers, which stay
-- on the server) and the day's tally. Every write checks `version`, so two answers landing
-- together never overwrite each other.
create table if not exists public.review_days (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null,
  session jsonb,
  cards int not null default 0,
  right_count int not null default 0,
  completed boolean not null default false,
  version int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.review_items enable row level security;
alter table public.review_days enable row level security;

-- Line hunt: 8 short snippets a day, the same for everyone; tap the line that holds the bug.
-- The cron (or the first player of a day it missed) writes one row per day. `snippets` holds each
-- snippet with its bug line, bug type and explanations, and never leaves the server whole: a line
-- is only shown once that round is answered. `source` is 'ai' when the cron added fresh snippets.
create table if not exists public.hunt_days (
  day date primary key,
  snippets jsonb not null default '[]',
  source text not null default 'pool' check (source in ('pool', 'ai')),
  created_at timestamptz not null default now()
);

-- One run per player and day. `rounds` is [{ servedAt, answeredAt, picked, correct, timedOut, ms,
-- points }], with times stamped by the server. score, correct and ms are the totals the
-- leaderboard sorts by; finished_at is set once all 8 rounds are answered. Every write checks
-- `version`, so two answers landing together never overwrite each other.
create table if not exists public.hunt_runs (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null,
  rounds jsonb not null default '[]',
  score int not null default 0,
  correct int not null default 0 check (correct between 0 and 8),
  ms int not null default 0,
  finished_at timestamptz,
  version int not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists hunt_runs_day on public.hunt_runs (day) where finished_at is not null;

alter table public.hunt_days enable row level security;
alter table public.hunt_runs enable row level security;

-- Direct messages (1:1) and communities. "if not exists" so this block can run again on a database
-- that already has the rest. The API checks every rule (membership, blocks, limits, demo accounts);
-- the checks here only cap sizes. Realtime only carries "changed" nudges, never a message.
-- Who can start a conversation with me.
alter table public.users add column if not exists allow_messages text not null default 'everyone' check (allow_messages in ('everyone', 'nobody'));

-- One conversation per pair of people: pair_key is both user ids, sorted, joined with ':'.
-- The last message is copied here so the inbox is one query.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  pair_key text not null unique,
  member_ids uuid[] not null,
  last_message_at timestamptz,
  last_sender_id uuid references public.users (id) on delete set null,
  last_message_body text,
  created_at timestamptz not null default now()
);

-- One row per person in a conversation: their unread mark and when they last read it.
-- last_message_at is copied from the conversation so the inbox sorts on this table's index.
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  last_read_at timestamptz,
  unread boolean not null default false,
  last_message_at timestamptz,
  primary key (conversation_id, user_id)
);
create index if not exists conversation_members_inbox on public.conversation_members (user_id, last_message_at desc) where last_message_at is not null;
create index if not exists conversation_members_unread on public.conversation_members (user_id) where unread;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_created on public.messages (conversation_id, created_at desc);

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
  name text not null check (char_length(name) between 3 and 40),
  description text not null default '' check (char_length(description) <= 300),
  topics text[] not null default '{}',
  color text not null default 'violet',
  icon text not null default 'bug',
  is_private boolean not null default false,
  owner_id uuid not null references public.users (id) on delete cascade,
  member_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists communities_popular on public.communities (member_count desc, created_at desc);
create index if not exists communities_owner on public.communities (owner_id);
create index if not exists communities_topics on public.communities using gin (topics);

-- role 'removed': the owner took this person out, and joining again is refused.
create table if not exists public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member', 'removed')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists community_members_user on public.community_members (user_id, joined_at desc);
create index if not exists community_members_list on public.community_members (community_id, joined_at);

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists community_messages_created on public.community_messages (community_id, created_at desc);

-- A block hides and forbids DMs both ways.
create table if not exists public.blocks (
  blocker_id uuid not null references public.users (id) on delete cascade,
  blocked_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked on public.blocks (blocked_id);

-- Reported messages, kept for review with a copy of the text (the message may be deleted later).
-- message_id points at messages or community_messages (by kind), so it has no foreign key.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users (id) on delete cascade,
  reported_user_id uuid references public.users (id) on delete set null,
  kind text not null check (kind in ('dm', 'community')),
  message_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  note text not null default '' check (char_length(note) <= 300),
  snapshot text not null default '',
  status text not null default 'open' check (status in ('open', 'reviewed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, kind, message_id)
);
create index if not exists reports_open on public.reports (created_at desc) where status = 'open';

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create or replace function public.refresh_community_member_count(p_community uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.communities c
  set member_count = (select count(*) from public.community_members m where m.community_id = c.id and m.role in ('owner', 'member'))
  where c.id = p_community;
$$;
revoke execute on function public.refresh_community_member_count(uuid) from public, anon, authenticated;

-- "Ada sent you a message" in the bell.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('comment', 'like', 'rating_valid', 'rating_bad', 'event_join', 'event_vote', 'event_winner', 'message'));
