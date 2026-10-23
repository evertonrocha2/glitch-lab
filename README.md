# Glitch Lab

> Paste the error. Understand why. Practice so it never happens again.

A **debugging gym for programming students**, built for GLITCHATHON 2026 (track: Glitch Detective). In English and Brazilian Portuguese.

**Live:** https://glitch-lab-app.vercel.app (press *Use demo account*). The API sleeps when idle on Render's free plan, so the first request can take about 50 seconds.

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
12. **Glitchdle.** A Loldle-style riddle a day: name the programming language from its traits, an error it printed, or a hidden snippet.
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

**Glitchdle** (`/glitchdle`) is a Loldle-style game about programming languages: a new riddle every day at midnight in Brasilia, the same for everyone, in three modes.

- **Classic.** Guess the language of the day. Each guess shows a row of cells against the answer: paradigms, typing, type strength, execution, memory, main domains, syntax family and year. Purple is the same, pale blue is some in common, white is different, and an arrow says if the answer is newer or older.
- **Error.** Which language printed this error? The file extension unlocks after 3 wrong guesses, the syntax family after 6.
- **Snippet.** A short snippet with most lines hidden; each wrong guess shows one more.
- **38 languages** in `shared/riddle/languages.js`, from JavaScript to COBOL and Prolog. Debatable classifications follow the mainstream answer, with a comment. Error samples and snippets live in `shared/riddle/samples.js` and never ship to the browser.
- **Secrets stay on the server.** The answers are picked from the date (no language repeats in a mode for 20 days) on the server only. Each guess is graded and saved there, so a reload keeps the board, and a mode only shows its answer once it's solved or out of guesses (30 per mode).
- **The same cron.** `POST /api/cron/daily` also writes today's and tomorrow's riddles, asking Gemini for one fresh error message (rejected if it names the language, its extension or its tools, then the dataset's is used). A day the cron missed is built from the dataset the first time someone plays.
- **Stats, sharing, XP.** Your games, perfect days (all three modes) and streak, a guess distribution, today's community numbers (demo accounts left out), and a Share button that copies a spoiler-free result. Each solved mode is worth 25 XP (1-2 guesses) down to 10, and *Lingo master* is all three modes in one day.

## Try it

Open the app and press **Use demo account**. Each visitor gets their own board, already filled with sample cases in every column, an open gym challenge, a notebook page, a 3-day study streak, a few badges and a study trail already half done, so you can try everything without waiting for the AI.

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

Without Supabase variables, accounts and data live in `.data/db.json`. Create an account on the login screen, or press **Use demo account**.

For production, create a Supabase project, run `supabase/schema.sql`, then set the variables listed in `.env.example` on the API host, Render (`AUTH_SECRET` included).

## Tests

```bash
bun run test
```

1,150+ tests cover the API (validation, limits, AI failures, secrets never leaking, other users' data), both stores, auth, XP and badges, the timer, the note editor, the export, and every page.

## Built with

React · Tailwind CSS · Vite · react-router · Bun · Vitest · Express · Supabase · Gemini API
