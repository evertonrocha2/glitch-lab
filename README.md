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

Open the app and press **Use demo account**. Each visitor gets their own board, already filled with sample cases in every column and an open gym challenge, so you can try everything without waiting for the AI.

## Architecture

```
React + Tailwind (Vite)  ──>  /api/* (Vercel Functions)  ──>  Gemini
                                   │
                         auth: Supabase JWT ─ store: Supabase Postgres
                         (dev: "Dev login" + a local JSON file)
```

- `api/analyze.js`, `api/cases.js`, `api/challenge.js`, `api/hint.js`, `api/check.js`: one function per route, each checking the signed-in user first.
- `api/_lib/ai`, `api/_lib/store`, `api/_lib/auth`: swappable layers. The same contract tests run against the local store and Supabase.
- `supabase/schema.sql`: tables with Row Level Security on and no client policies. The browser can't read any row directly.

## Run it locally

```bash
bun install
cp .env.example .env      # add your GEMINI_API_KEY
bun run dev               # http://localhost:5173
```

Without Supabase variables the app runs in **dev mode**: "Dev login" and "Use demo account" work offline, and data lives in `.data/db.json`. `bun scripts/seed-demo.js` fills a demo board.

For production, create a Supabase project, run `supabase/schema.sql`, enable **Anonymous sign-ins** (for the demo button) and the **GitHub** provider, then set the variables listed in `.env.example` on Vercel.

## Tests

```bash
bun run test
```

150+ tests cover the API (validation, limits, AI failures, secrets never leaking, other users' data), both stores, auth, and every page.

## Built with

React · Tailwind CSS · Vite · react-router · Bun · Vitest · Vercel Functions · Supabase · Gemini API
