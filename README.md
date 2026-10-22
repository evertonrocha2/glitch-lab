# Glitch Detective

> Paste the error. Understand why. Practice so it never happens again.

A **debugging gym for programming students**, built for GLITCHATHON 2026 (track: Glitch Detective).

## Why not just paste the error into ChatGPT?

Chatbots hand you the fix. You paste it, it works, and next week you write the same bug again. That's fine at 2 a.m. before a deadline, but it never builds the skill you need in an exam, an interview or a live-coding session.

Glitch Detective uses AI the other way around: **it hides the answer and trains you.**

## What it does

1. **Investigate.** Paste an error, the code, or attach files or a whole folder. A live scan reads the error type, language and file:line spots before any AI, and the files the error mentions are sent trimmed to the lines around it. You get clues from the error, the likely spot, what happened, the concept behind it and the fix, hidden until you ask for it. Every investigation becomes a **case** tagged with its bug type ("Reading undefined", "Index out of range", ...).
2. **Study your board.** Your cases live on a Kanban board, **New → Training → Solved**, with a summary that names your **weak spot**: the bug type you hit most.
3. **Train in the gym.** From any case, the AI **writes a brand-new program with the same kind of bug**. You see only the symptom. Fix it in the editor; hints unlock one at a time, from vague to almost-the-answer. The AI **judges your fix** against a reference solution it never shows you. Pass 2 challenges and the case is solved.
4. **Write it down.** A Notion-style notebook: headings, text, to-dos, and your cases as blocks. Type **@** to drop a case into the page, **/** for other blocks. Every case links to the notes that mention it. Notes save on their own.
5. **Track your study time.** A pixel stopwatch sits on every page. It keeps running through reloads and counts each day on your own clock.
6. **Follow a study trail.** Press *Build my study trail* and the AI reads your cases and notes, finds your weak spot and lays out 5 to 7 missions on a pixel path: train a case in the gym, write a note about a case, study with the timer, investigate a new error, or reflect. Missions tick themselves when you do them (only *reflect* is ticked by hand). Each one earns XP, and finishing the trail adds a 100 XP bonus and the *Trailblazer* badge.
7. **Level up.** Cases, passed challenges, notes, study minutes, trail missions, daily puzzles and community activity earn XP. Climb from *Rookie* to *Bug Whisperer*, keep a daily study streak, and collect 17 badges (*Sharp eye*: pass without hints, *On a roll*: 3 days in a row, ...).
8. **Take it with you.** Export the whole board or one note as Markdown, a PNG image or an A4 PDF in the same pixel look (pages never cut a card in half).
9. **Show who you are.** A profile with a pixel avatar, bio, what you do, university, job, languages and links, featured badges, and public notes. Make it public at `/u/<handle>` and find other detectives at `/people`.
10. **Ask the detective.** A side panel where a router agent hands your question to specialist agents (board, gym, notes, study, app guide) that answer together.
11. **Daily and global challenges.** Three puzzles a day for everyone and a weekly global one with a leaderboard, fed by a daily cron.
12. **Share what you learned.** Publish short articles in the community (`/articles`, readable signed out). Others like them, rate them *valid* or *bad*, and comment; a bell tells you when they do. Search by words, tag or author and sort by newest, likes or valid ratings. Articles, likes, valid ratings and comments earn XP (capped, so it can't be farmed) and two more badges: *Author* and *Trusted*. A linked case shows only its error type, bug type and language, never your code. Everything runs through one function, `api/community.js` (`?resource=articles|comments|reactions|notifications`). Demo accounts can read, but not publish, comment, like or rate.

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

## Ask the detective (an orchestration of agents)

A side panel on every signed-in page (header button, **Alt+A** or **Ctrl+/**) where you can ask about anything in the app. One question runs through a small team of agents in `api/assistant.js` and `api/_lib/assistant/`:

1. **Router agent** picks 1 or 2 specialists and the data each needs, knowing which page (and which case, note or challenge) you're on. If it fails, a keyword and page based choice takes over.
2. **Context loaders** read only what each specialist needs, only for you, trimmed to a budget. The gym loader never reads challenge secrets and only sees the hints you've revealed.
3. **Specialists run in parallel**: Board analyst, Gym coach, Notes keeper, Study planner, App guide. Your content is fenced off as data, and every one of them is a tutor: no full fixes for gym challenges, just nudges.
4. **Merge and check**: two answers are stacked (no third slow AI call), and suggested actions (open a case or note, train a case, start the timer, go to a page) are checked on the server: ids must be yours, pages from an allowlist.

One question counts as one AI call on the daily limit. The chat lives in the browser session only.

## Daily and global challenges

The **Daily** page has 3 new puzzles every day (easy, medium, hard), the same for everyone, plus one harder **global challenge** a week with a leaderboard.

- **A cron feeds them.** Vercel runs `GET /api/challenge?cron=1` daily at 03:00 UTC (midnight in Brasilia), signed with `CRON_SECRET`. It asks Gemini for today's and tomorrow's puzzles, so the next set is ready the moment the day turns, plus the week's global challenge. Bug types and languages rotate, recent titles are avoided, and every answer is validated strictly. Running it twice adds nothing.
- **Always something to solve.** If the cron didn't run or the AI is down, the day is filled from a curated pool of 15 hand-written puzzles (`api/_lib/puzzles/pool.js`), picked by date so everyone still gets the same set.
- **Same gym, same secrets.** Solving a puzzle opens the regular gym: hints one at a time, and the AI judges your fix against a solution that never reaches the browser. Starting a puzzle costs no AI call.
- **XP and badges.** Easy 20, medium 35, hard 50, global 100 XP. *Daily grinder*: a daily solved 7 days in a row. *Global ace*: solve a global challenge.
- **Leaderboard.** Top 10 by time from start to pass, then fewer attempts, with the first solver marked. Only public profiles show a name and avatar; everyone else is an "Anonymous detective". No emails, no account ids.

## Try it

Open the app and press **Use demo account**. Each visitor gets their own board, already filled with sample cases in every column, an open gym challenge, a notebook page, a 3-day study streak, a few badges and a study trail already half done, so you can try everything without waiting for the AI.

## Architecture

```
React + Tailwind (Vite)  ──>  /api/* (Vercel Functions)  ──>  Gemini
                                   │
                         auth: email + password, signed sessions
                         store: Supabase Postgres (dev: a local JSON file)
```

- Accounts: passwords hashed with scrypt, sessions signed with HMAC and valid for 7 days. Emails are unique and case-insensitive. After 10 wrong passwords an email is locked for the day.

- `api/analyze.js`, `api/cases.js`, `api/challenge.js`, `api/hint.js`, `api/check.js`, `api/notes.js`, `api/progress.js`, `api/trail.js`, `api/auth.js`: one function per route, each checking the signed-in user first (sign in, sign up and the demo share `api/auth.js`, so the app stays under the 12 functions of the Vercel free plan).
- `shared/progress.js`: XP, levels, streaks and badges are worked out from what you've done, never stored, so they can't drift out of sync.
- `api/_lib/ai`, `api/_lib/store`, `api/_lib/auth`: swappable layers. The same contract tests run against the local store and Supabase.
- `supabase/schema.sql`: tables with Row Level Security on and no client policies. The browser can't read any row directly.

## Run it locally

```bash
bun install
cp .env.example .env      # add your GEMINI_API_KEY
bun run dev               # http://localhost:5173
```

Without Supabase variables, accounts and data live in `.data/db.json`. Create an account on the login screen, or press **Use demo account**.

For production, create a Supabase project, run `supabase/schema.sql`, then set the variables listed in `.env.example` on Vercel (`AUTH_SECRET` included).

## Tests

```bash
bun run test
```

700+ tests cover the API (validation, limits, AI failures, secrets never leaking, other users' data), both stores, auth, XP and badges, the timer, the note editor, the export, and every page.

## Built with

React · Tailwind CSS · Vite · react-router · Bun · Vitest · Vercel Functions · Supabase · Gemini API
