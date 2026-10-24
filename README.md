# Glitch Lab

> Paste the error. Understand why. Practice so it never happens again.

A **debugging gym for programming students**, built for GLITCHATHON 2026 (track: Glitch Detective). In English and Brazilian Portuguese.

**Live:** https://glitch-lab-app.vercel.app (create a free account to try it). The API sleeps when idle on Render's free plan, so the first request can take about 50 seconds.

**How it all works** (hosting, cron, layers, flows), in Portuguese: [docs/como-funciona.md](docs/como-funciona.md).

## Why not just paste the error into ChatGPT?

Chatbots hand you the fix. You paste it, it works, and next week you write the same bug again. That's fine at 2 a.m. before a deadline, but it never builds the skill you need in an exam, an interview or a live-coding session.

Glitch Lab uses AI the other way around: **it hides the answer and trains you.**

## What it does

1. **Investigate.** Paste an error, the code, or attach files or a whole folder. A live scan reads the error type, language and file:line spots before any AI, and the files the error mentions are sent trimmed to the lines around it. You get clues from the error, the likely spot, what happened, the concept behind it and the fix, hidden until you ask for it. Every investigation becomes a **case** tagged with its bug type ("Reading undefined", "Index out of range", ...).
2. **Study your board.** Your cases live on a Kanban board, **New → Training → Solved**, with a summary that names your **weak spot**: the bug type you hit most.
3. **Train in the gym.** From any case, the AI **writes a brand-new program with the same kind of bug**. You see only the symptom. Fix it in the editor; hints unlock one at a time, from vague to almost-the-answer. The AI **judges your fix** against a reference solution it never shows you. Pass 2 challenges and the case is solved.
4. **Write it down.** A Notion-style notebook: headings, text, to-dos, and your cases as blocks. Type **@** to drop a case into the page, **/** for other blocks. Every case links to the notes that mention it. Notes save on their own.
5. **Track your study time.** A pixel stopwatch sits on every page. It keeps running through reloads and counts each day on your own clock.
6. **Follow a study trail.** Press *Build my study trail* and the AI reads your cases and notes, finds your weak spot and lays out 5 to 7 missions on a pixel path: train a case in the gym, write a note about a case, study with the timer, investigate a new error, or reflect. Missions tick themselves when you do them (only *reflect* is ticked by hand). Each one earns XP, and finishing the trail adds a 100 XP bonus and the *Trailblazer* badge.
7. **Level up.** Cases, passed challenges, notes, study minutes, trail missions, daily puzzles, Glitchdle, line hunt, reviews, interrogations, duels, events and community activity earn XP. Climb from *Rookie* to *Bug Whisperer*, keep a daily study streak, and collect 27 badges (*Sharp eye*: pass without hints, *On a roll*: 3 days in a row, ...).
8. **Take it with you.** Export the whole board or one note as Markdown, a PNG image or an A4 PDF in the same pixel look (pages never cut a card in half).
9. **Show who you are.** A profile with a pixel avatar, bio, what you do, university, job, languages and links, featured badges, and public notes. Make it public at `/u/<handle>` and find other people at `/people`.
10. **Lab assistant.** A side panel where a router agent hands your question to specialist agents (board, gym, notes, study, app guide) that answer together.
11. **Daily and global challenges.** Three puzzles a day for everyone and a weekly global one with a leaderboard, fed by a daily cron.
12. **Glitchdle.** A Loldle-style riddle a day: name the programming language from its traits, an error it printed or a hidden snippet, then the framework and the database of the day.
13. **Line hunt.** A timed daily game (`/hunt`): 8 snippets, 20 seconds each, tap the line that holds the bug. The server times every answer, the same set goes to everyone, and there's a leaderboard and a free practice mode.
14. **Interrogate the bug.** From any case, a Socratic coach walks you through the 6 steps of debugging (reproduce, read the error, hypothesis, isolate, fix, prevent). It answers each step with feedback and one guiding question, and a server-side guard stops it from handing over the fix before step 5. Export the finished interrogation as a note.
15. **Spaced review.** Every bug type you've met comes back after 1, 3, 7, 14 and 30 days as quick cards built from your own cases: what causes this error, which line is wrong, pick the fix. No AI call, so it's instant. A skill map on the Progress page shows your mastery per bug type and points at the weakest one.
16. **Duel (1v1).** A 5-round quiz race against a friend (room code), a random opponent or the Glitch Bot. The fastest right answer scores more, the server times every answer, and leaving the tab is detected and shown to both players. Moves reach the other player in about 50 ms through Supabase Realtime, with polling as a fallback.
17. **Events.** Anyone can host a community event, like a backend battle: people send entries with repo, video and demo links, everyone votes, the host picks the podium. Taking part, placing and hosting earn XP, counted only for real events (3+ different people, at least an hour long).
18. **Share what you learned.** Publish short articles in the community (`/articles`, readable signed out). Others like them, rate them *valid* or *bad*, and comment; a bell tells you when they do. Search by words, tag or author and sort by newest, likes or valid ratings. Articles, likes, valid ratings and comments earn XP (capped, so it can't be farmed) and two more badges: *Author* and *Trusted*. A linked case shows only its error type, bug type and language, never your code. The API lives in `server/modules/articles` (`/api/articles`, `/api/comments`, `/api/notifications`). Demo accounts can read, but not publish, comment, like or rate.

## How AI is used

| Step | Prompt | Output (JSON schema) |
|---|---|---|
| Investigate | Patient teacher, plain English, focus on *why* | explanation, cause, fix, mini exercise, **bug type** (from a fixed list), language |
| Write a challenge | New code, same bug type and language, one bug only | broken code, symptom, 3 hints, **secret** solution, bug explanation |
| Judge a fix | Accept any fix that removes the bug; student code is fenced off as data | passed, feedback |
| Build a study trail | Coach, plain English, weak spot first; cases and notes are fenced off as data | title, summary, 5 to 7 missions (kind, case, concept, minutes). The server drops any mission with an unknown kind, a case that isn't yours or a made-up concept, clamps minutes, and sets the XP itself |

- Model: **Gemini** (`gemini-3.8-flash`) via the REST API with `responseSchema`, so every answer is valid, typed JSON.
- The solution and the hints you haven't unlocked **never reach the browser**. They live server-side, and the API only returns what you're allowed to see.
- Sending back the untouched broken code is answered for free ("You haven't changed anything yet."), with no AI call.
- Every AI call has a time limit and one retry when the model is busy. Each account has a daily AI limit, so the free quota survives a demo.
- The AI layer is provider-agnostic (`generateJson`), so other models can be added without touching the endpoints.

## Lab assistant (an orchestration of agents)

A side panel on every signed-in page (header button, **Alt+A** or **Ctrl+/**) where you can ask about anything in the app. One question runs through a small team of agents in `server/modules/assistant/` (`POST /api/assistant`):

1. **Router agent** picks 1 or 2 specialists and the data each needs, knowing which page (and which case, note or challenge) you're on. If it fails, a keyword and page based choice takes over.
2. **Context loaders** read only what each specialist needs, only for you, trimmed to a budget. The gym loader never reads challenge secrets and only sees the hints you've revealed.
3. **Specialists run in parallel**: Board analyst, Gym coach, Notes keeper, Study planner, App guide. Your content is fenced off as data, and every one of them is a tutor: no full fixes for gym challenges, just nudges.
4. **Merge and check**: two answers are stacked (no third slow AI call), and suggested actions (open a case or note, train a case, start the timer, go to a page) are checked on the server: ids must be yours, pages from an allowlist.

One question counts as one AI call on the daily limit, plus one per extra specialist. The chat lives in the browser session only. The App guide knows every page and leads with the one you're on, so "what can I do here?" gets concrete next steps.

**Streaming.** The panel asks `POST /api/assistant/stream`, which answers with Server-Sent Events: `step` (routing, who answers, loading data), `delta` (`{ agent, text }` as the model writes), then `done` (the same payload as `POST /api/assistant`) or `error` (`{ message }`). Specialists write plain text and end with one `ACTIONS: [...]` line; the server holds back anything that could be that line, so it never reaches the screen, and checks the actions at the end as before. Two specialists write at the same time, and the second one's text waits until the first is done. The AI layer streams from OpenRouter and Gemini (`streamText` in `server/infra/ai`) and only falls back to the next provider before the first word. Closing the panel or pressing Stop aborts the AI call. The browser reads the stream with `fetch` (EventSource can't POST or send a token) and falls back to the plain endpoint if the stream can't be used before any text arrives. Vercel's `/api` rewrite passes the stream through unbuffered (measured: words arrive every ~170 ms, same as calling Render directly); if a proxy ever buffers it, set `VITE_API_STREAM_URL` to the API's own origin to call it directly for this one route (that needs CORS for the app's origin on the API).

## Daily and global challenges

The **Daily** page has 3 new puzzles every day (easy, medium, hard), the same for everyone, plus one harder **global challenge** a week with a leaderboard.

- **A cron feeds them.** A GitHub Actions workflow calls `POST /api/cron/daily` daily at 03:00 UTC (midnight in Brasilia), signed with `CRON_SECRET`. It asks Gemini for today's and tomorrow's puzzles, so the next set is ready the moment the day turns, plus the week's global challenge. Bug types and languages rotate, recent titles are avoided, and every answer is validated strictly. Running it twice adds nothing.
- **Always something to solve.** If the cron didn't run or the AI is down, the day is filled from a curated pool of 15 hand-written puzzles (`server/modules/daily/puzzle-pool.js`), picked by date so everyone still gets the same set.
- **Same gym, same secrets.** Solving a puzzle opens the regular gym: hints one at a time, and the AI judges your fix against a solution that never reaches the browser. Starting a puzzle costs no AI call.
- **XP and badges.** Easy 20, medium 35, hard 50, global 100 XP. *Daily grinder*: a daily solved 7 days in a row. *Global ace*: solve a global challenge.
- **Leaderboard.** Top 10 by time from start to pass, then fewer attempts, with the first solver marked. Only public profiles show a name and avatar; everyone else is an "Anonymous player". No emails, no account ids.

## Glitchdle

**Glitchdle** (`/glitchdle`) is a Loldle-style game about the tools you code with: new riddles every day at midnight in Brasilia, the same for everyone, in three categories.

- **Languages, in three modes.** *Classic*: each guess shows a row of cells against the answer (paradigms, typing, type strength, execution, what runs it, memory, main domains, syntax family, whether indentation matters, ISO or Ecma standard, Stack Overflow questions, year). *Error*: which language printed this error? The file extension unlocks after 3 wrong guesses, the syntax family after 6. *Snippet*: most lines hidden; each wrong guess shows one more.
- **Frameworks** (89): main language, what runs it and how its language is typed (both follow the language), area, framework or library, maker, license, Stack Overflow questions, how many Wikipedias have an article and first release.
- **Databases** (76): data model, query style, ACID transactions (full, partial or none), where the data lives (memory or disk), written in, maker, license, how it runs (server, embedded, cloud only), Stack Overflow questions, Wikipedias and first release.
- **Grading.** Purple is the same, amber with a hatch and a "~" is some in common (lists that overlap, or values in one family: MIT and BSD are both permissive, C and C++, JavaScript and TypeScript), white is different. Arrows say if the answer is newer, or in a higher bucket (Stack Overflow questions, Wikipedias, ACID transactions).
- **Hints on classic boards.** After 5 wrong guesses a free trait shows (the first column none of those guesses matched; the decade instead of the exact year), after 8 the first letter of the answer, after 12 the length of its name. The server counts them and only sends the hints already unlocked.
- **Secrets stay on the server.** Each board's answer is picked from the date and a server secret (no language repeats in a mode within 30 days, no framework or database within 60). Each guess is graded and saved there, so a reload keeps the board, and a board only shows its answer once it's solved or out of guesses (30 each).
- **The same cron.** `POST /api/cron/daily` also writes today's and tomorrow's boards. Error and Snippet ask the AI for a fresh clue, refused if it names the language or repeats a known one; every good AI clue joins that language's pool, so a day the AI fails still picks from the dataset plus everything the AI wrote before. A day the cron missed is built from the dataset the first time someone plays.
- **Stats, sharing, XP.** Your games, perfect days (the three language modes) and streak, a guess distribution per board, today's community numbers (demo accounts left out), and *Copy result* (the share sheet on phones): one line per board, the last 4 rows of the grid, the streak and a link, in your language. Each solved board is worth 25 XP (1-2 guesses) down to 10, at most 100 a day. *Lingo master* is the three language modes in one day, *Full stack* is every board.

### Where the frameworks and databases come from

`node scripts/sync-glitchdle.mjs` builds `shared/riddle/catalogs/*.js` from free public data, no keys:

1. **Seeds** (`scripts/glitchdle/seeds.js`): which items may play, by Stack Overflow tag, with their English name and, when the name is ambiguous, a pinned Wikidata id.
2. **Wikidata** (SPARQL, CC0): one query finds each item (by its Stack Overflow tag, P1482, or by name), one more reads its type, use, language, license, developer, first release and how many Wikipedias have an article on it (its sitelinks).
3. **Stack Exchange API** (CC BY-SA 4.0): one request counts the Stack Overflow questions of every tag, bucketed per category, and one more counts the languages' tags (`LANGUAGE_TAGS`), saved to `shared/riddle/catalogs/language-questions.js`. The languages themselves stay hand-curated in `shared/riddle/languages.js`.
4. **Normalize and validate** (`scripts/glitchdle/normalize.js`): labels become our trait vocabulary; an item missing any trait is dropped and the sync says why.
5. **Overrides** (`scripts/glitchdle/overrides.js`): hand fixes with a reason each, for data Wikidata lacks or judgment calls (Express is backend; CouchDB is written in Erlang). ACID transactions for every database that isn't relational, the in-memory ones and the makers Wikidata leaves out are reviewed lists there, each value from the database's own docs.
6. **Derived traits**: a framework's runtime and typing come from its main language, after the overrides; a relational database gets full ACID.

Seven requests in all, sent with a descriptive User-Agent and cached for the day in `node_modules/.cache/glitchdle-sync`. To refresh: run the sync, read the diff of `shared/riddle/catalogs/`, fix anything odd in the overrides, run it again, run the tests and commit. The snapshot is what the game uses, so it works offline and tests stay deterministic (they read recorded answers in `tests/fixtures/glitchdle`). Days already saved keep their answer; a refresh can only change days not written yet.

Data: [Wikidata](https://www.wikidata.org) (CC0) and [Stack Overflow](https://stackoverflow.com/tags) tag counts via the Stack Exchange API (CC BY-SA 4.0), for the languages' question counts too. The Glitchdle page shows the same credit.

## Try it

Open the live site, press **Create a free account** and sign up with an email and a password. Then paste an error on the board to open your first case.

The one-click demo account exists only in local development: press **Use demo account** on the sign-in page and you get your own board, already filled with sample cases in every column, an open gym challenge, a notebook page, a 3-day study streak, a few badges and a study trail already half done, so you can try everything without waiting for the AI. The live site has no demo: the API answers 404 on `/api/auth/demo` unless `DEMO_LOGIN=1`, and the production build shows no demo button unless it's built with `VITE_DEMO_LOGIN=1`. Neither is set.

## Architecture

```
React + Tailwind (Vite, on Vercel)  ──>  /api/* (Express on Render)  ──>  Gemini
          │                                   │
          │                         auth: email + password, signed sessions
          │                         store: Supabase Postgres (dev: a local JSON file)
          └── duels live ──> Supabase Realtime

GitHub Actions, daily at 03:00 UTC ──> POST /api/cron/daily (today's and tomorrow's content)
```

| Piece | Where | What it does |
|---|---|---|
| Site | Vercel | Serves the built React app and forwards `/api/*` to Render (`vercel.json`) |
| API | Render (`render.yaml` blueprint) | Express app, `node server/index.js`, health check at `/healthz` |
| Daily cron | GitHub Actions (`.github/workflows/daily-cron.yml`) | Wakes the API and calls the cron with `CRON_SECRET` |
| Data | Supabase | Postgres with RLS on everything, plus Realtime broadcast for duels |
| AI | Gemini | Every call through `generateJson` with a JSON schema, a time limit and a daily quota |

The front end keeps every page and component in its own kebab-case folder (`src/pages/hunt-page/hunt-page.jsx`, `src/components/hunt/code-lines/code-lines.jsx`), with the test next to it. Every API call goes through `src/lib/api.js`.

- Accounts: passwords hashed with scrypt, sessions signed with HMAC and valid for 7 days. Emails are unique and case-insensitive. After 10 wrong passwords an email is locked for the day.

- `server/`: an Express 5 app in layers. `server/app.js` builds it (JSON body, locale, routes, 404 and error handler) and `server/index.js` runs it.
  - `core/`: what every route shares: `AppError`, the auth middleware (`requireAuth`, `optionalAuth`), the locale, validation helpers.
  - `infra/`: the outside world: `database/` (the store, local JSON or Supabase), `ai/` (Gemini, the daily AI quota), `security/` (passwords, sessions).
  - `modules/<feature>/`: one folder per feature (auth, profile, cases, challenges, daily, glitchdle, hunt, duels, notes, progress, review, trails, interrogation, articles, events, assistant, cron). `*.routes.js` names the paths and middlewares, `*.controller.js` reads the request and writes the response, `*.service.js` holds the rules and never sees `req` or `res`.
- In dev, Vite mounts the same Express app under `/api`, so `bun run dev` is the whole app. In production Vercel serves the site and forwards `/api/*` to Render (`render.yaml`, `bun run start`).
- `shared/progress.js`: XP, levels, streaks and badges are worked out from what you've done, never stored, so they can't drift out of sync.
- `server/infra/ai`, `server/infra/database`, `server/infra/security`: swappable layers. The same contract tests run against the local store and Supabase.
- `supabase/schema.sql`: tables with Row Level Security on and no client policies. The browser can't read any row directly.

## Run it locally

```bash
bun install
cp .env.example .env      # add your GEMINI_API_KEY
bun run dev               # http://localhost:5173
```

Without Supabase variables, accounts and data live in `.data/db.json`. Create an account on the login screen, or press **Use demo account** (local development only).

For production, create a Supabase project, run `supabase/schema.sql`, then set the variables listed in `.env.example` on the API host, Render (`AUTH_SECRET` included).

## Tests

```bash
bun run test
```

1,150+ tests cover the API (validation, limits, AI failures, secrets never leaking, other users' data), both stores, auth, XP and badges, the timer, the note editor, the export, and every page.

## Built with

React · Tailwind CSS · Vite · react-router · Bun · Vitest · Express · Supabase · Gemini API
