# Glitch Detective

> Paste the error. Understand why. Practice so it never happens again.

A **debugging gym for programming students**, built for GLITCHATHON 2026 (track: Glitch Detective).

## Why not just paste the error into ChatGPT?

Chatbots hand you the fix. You paste it, it works, and next week you write the same bug again. That's fine at 2 a.m. before a deadline, but it never builds the skill you need in an exam, an interview or a live-coding session.

Glitch Detective uses AI the other way around: **it hides the answer and trains you.**

## What it does

1. **Investigate.** Paste an error (and the code, if you have it). You get what happened, the concept behind it and the fix, hidden until you ask for it. Every investigation becomes a **case** tagged with its bug type ("Reading undefined", "Index out of range", ...).
2. **Study your board.** Your cases live on a Kanban board, **New → Training → Solved**, with a summary that names your **weak spot**: the bug type you hit most.
3. **Train in the gym.** From any case, the AI **writes a brand-new program with the same kind of bug**. You see only the symptom. Fix it in the editor; hints unlock one at a time, from vague to almost-the-answer. The AI **judges your fix** against a reference solution it never shows you. Pass 2 challenges and the case is solved.
4. **Write it down.** A Notion-style notebook: headings, text, to-dos, and your cases as blocks. Type **@** to drop a case into the page, **/** for other blocks. Every case links to the notes that mention it. Notes save on their own.
5. **Track your study time.** A pixel stopwatch sits on every page. It keeps running through reloads and counts each day on your own clock.
6. **Level up.** Cases, passed challenges, notes and study minutes earn XP. Climb from *Rookie* to *Bug Whisperer*, keep a daily study streak, and collect 12 badges (*Sharp eye*: pass without hints, *On a roll*: 3 days in a row, ...).
7. **Take it with you.** Export the whole board, or one note, as Markdown. Notion, Obsidian and GitHub all read it.

## How AI is used

| Step | Prompt | Output (JSON schema) |
|---|---|---|
| Investigate | Patient teacher, plain English, focus on *why* | explanation, cause, fix, mini exercise, **bug type** (from a fixed list), language |
| Write a challenge | New code, same bug type and language, one bug only | broken code, symptom, 3 hints, **secret** solution, bug explanation |
| Judge a fix | Accept any fix that removes the bug; student code is fenced off as data | passed, feedback |

- Model: **Gemini** (`gemini-3.8-flash`) via the REST API with `responseSchema`, so every answer is valid, typed JSON.
- The solution and the hints you haven't unlocked **never reach the browser**. They live server-side, and the API only returns what you're allowed to see.
- Sending back the untouched broken code is answered for free ("You haven't changed anything yet."), with no AI call.
- Every AI call has a time limit and one retry when the model is busy. Each account has a daily AI limit, so the free quota survives a demo.
- The AI layer is provider-agnostic (`generateJson`), so other models can be added without touching the endpoints.

## Try it

Open the app and press **Use demo account**. Each visitor gets their own board, already filled with sample cases in every column, an open gym challenge, a notebook page, a 3-day study streak and a few badges, so you can try everything without waiting for the AI.

## Architecture

```
React + Tailwind (Vite)  ──>  /api/* (Vercel Functions)  ──>  Gemini
                                   │
                         auth: email + password, signed sessions
                         store: Supabase Postgres (dev: a local JSON file)
```

- Accounts: passwords hashed with scrypt, sessions signed with HMAC and valid for 7 days. Emails are unique and case-insensitive. After 10 wrong passwords an email is locked for the day.

- `api/analyze.js`, `api/cases.js`, `api/challenge.js`, `api/hint.js`, `api/check.js`, `api/notes.js`, `api/progress.js`, `api/auth.js`: one function per route, each checking the signed-in user first (sign in, sign up and the demo share `api/auth.js`, so the app stays under the 12 functions of the Vercel free plan).
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

250+ tests cover the API (validation, limits, AI failures, secrets never leaking, other users' data), both stores, auth, XP and badges, the timer, the note editor, the export, and every page.

## Built with

React · Tailwind CSS · Vite · react-router · Bun · Vitest · Vercel Functions · Supabase · Gemini API
