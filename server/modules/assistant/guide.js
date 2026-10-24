import { BADGES } from '../../../shared/badges.js'
import { LEVELS } from '../../../shared/progress.js'
import { DAILY_AI_LIMIT } from '../../infra/ai/quota.js'

// What the App guide specialist knows. Static on purpose: no student data, nothing to leak.
// One section per page, so the guide can lead with the page the student is on. English button
// names: the pt-BR rule in the prompt tells the AI to describe them by what they do.

const levels = LEVELS.map((level) => `${level.title} ${level.min}`).join(', ')

export const GUIDE_SECTIONS = [
  {
    id: 'landing',
    name: 'Landing page',
    match: /^\/$/,
    text: `What Glitch Lab is: a debugging gym. Paste an error, understand why it broke, then practice so it never happens again. The form here saves your error and opens the board (sign in first if needed). Top links: How it works, Features, FAQ, Articles, Sign in, Create account. The hero buttons "Create a free account" and "Sign in" open the sign in page.`,
  },
  {
    id: 'login',
    name: 'Sign in page',
    match: /^\/login$/,
    text: `Sign in, or "Create an account" then "Create account" (email and a password of at least 8 characters). Signing up is free.`,
  },
  {
    id: 'board',
    name: 'Board',
    match: /^\/board$/,
    text: `"New investigation": paste the error message, plus optional code, up to 5 project files or a folder ("Upload files", "Upload a folder", or drag and drop), and what you were trying to do. Never paste passwords, API keys or .env files. Press "Investigate": the AI shows clues from the error, the likely spot, what happened and why. The fix and the practice answer stay hidden until you press show. Each investigation is a case with a bug type, in a column: New, Training, Solved (2 gym challenges passed). The summary names your weak spot: the bug type you hit most among open cases. Click a case to open it: "Train this" (gym), "Interrogate the bug" (6 steps, +60 XP), "Write a note about this". "Export" saves the board as Markdown, PNG image or PDF. Cases cannot be deleted. "Ask a question" opens a chat with a tutor for a doubt in your own words (code optional): it explains in small steps and asks one question at a time, up to 12 questions per chat, one AI call each. Once it knows the topic it offers "Create a board card": a Question card with the topic, a summary, an explanation and a practice exercise, that trains, reviews and interrogates like any case.`,
  },
  {
    id: 'gym',
    name: 'Gym challenge',
    match: /^\/gym\/[^/]+$/,
    text: `"Fix the bug": a new small program with the same kind of bug as your case. Read "What you see when you run it", edit "Your fix" and press "Submit fix"; the AI checks it. "Get a hint" unlocks 3 hints one at a time, from vague to almost the answer (hints are free). Attempts are counted. A pass gives 30 XP, +15 with no hints. Pass 2 challenges and the case is solved. Daily and weekly puzzles also play here.`,
  },
  {
    id: 'interrogation',
    name: 'Bug interrogation',
    match: /^\/interrogate\/[^/]+$/,
    text: `Question one of your cases like a detective, in 6 steps that unlock in order: Reproduce, Read the error, Hypothesis, Isolate, Fix, Prevent. Write your answer and press "Send answer"; an AI coach says "Step passed" or "Not yet" with a question to think about, and never gives the fix before the Fix step. Each answer uses one AI call. Finishing gives +60 XP once per case and the Scientific method badge. "Export as note" turns it into a note. Start it from a case on the board.`,
  },
  {
    id: 'daily',
    name: 'Daily page',
    match: /^\/daily$/,
    text: `3 daily bugs, the same for everyone (Easy 20, Medium 35, Hard 50 XP), played in the gym. New ones at 03:00 UTC (midnight in Brasilia). Solving one a day keeps a daily streak. The weekly global challenge (Monday to Sunday, several chained bugs, 100 XP) has a leaderboard: fastest pass first, then fewer attempts. Also here: "Today's review" (spaced review), a Glitchdle card and the Line hunt.`,
  },
  {
    id: 'review',
    name: 'Spaced review',
    match: null,
    text: `"Today's review" on the Daily page: up to 5 quick cards a session built from your own cases (no AI): what kind of bug causes this, which line has the bug, which change fixes it. Right moves a card up a box (back in 1, 3, 7, 14, 30 days), wrong sends it back to box 1. 3 XP per right card, up to 10 a day. 7 days of finished reviews gives Elephant memory. The skill map on Progress shows mastery per bug type and a "Train" button for the weakest.`,
  },
  {
    id: 'glitchdle',
    name: 'Glitchdle',
    match: /^\/glitchdle$/,
    text: `Guess the tools of the day, the same for everyone. Languages has 3 modes: Classic (each guess compares 12 traits: typing, paradigm, runtime, year...), Error (which language printed this error; hints after 3 and 6 wrong guesses), Snippet (one more line shows after each wrong guess). Frameworks and Databases are classic boards (language, license, ACID transactions...) built from Wikidata and Stack Overflow data. Classic boards give hints after 5, 8 and 12 misses. 10 to 25 XP per solved board, more for fewer guesses, at most 100 a day. "Copy result". Solve all 3 language modes in a day for Lingo master, every board for Full stack.`,
  },
  {
    id: 'hunt',
    name: 'Line hunt',
    match: /^\/hunt$/,
    text: `Find the buggy line: 8 snippets, 20 seconds each. Click the line, or use the arrow keys and Enter. 100 points plus up to 50 for speed. One ranked run a day (today's top 10), 5 XP per line, +10 for a perfect run, and the Eagle eye badge. The Practice tab plays without XP or ranking. Open it from the Daily page.`,
  },
  {
    id: 'duel',
    name: 'Duel lobby',
    match: /^\/duel$/,
    text: `1 vs 1 quiz: 5 rounds of 15 seconds (which language printed this error, which language is this snippet, what kind of bug is it). Keys 1 to 4 answer; 100 points plus up to 100 for speed. "Quick match" joins the queue (after 20 seconds it offers the bot), "Play the Glitch Bot", "Create a private duel" (share the link or code) or "Join with a code". Rating starts at 1000 and only changes against people. XP: win 40, draw 25, loss 10; bot games pay half. Badges: Duelist, Speed demon.`,
  },
  {
    id: 'duel-room',
    name: 'Duel',
    match: /^\/duel\/[^/]+$/,
    text: `A duel in progress. Answer fast with the mouse or keys 1 to 4. Leaving the tab while a round is open scores that round 0, and 30 seconds away counts as giving up ("Give up" is also a button). After it ends: "Rematch", "Play the bot again" or "Copy result link".`,
  },
  {
    id: 'notes',
    name: 'Notes',
    match: /^\/notes(\/[^/]+)?$/,
    text: `Like Notion. "New note": text, headings, lists, to-dos, code, quotes, callouts, cases. / anywhere inserts a block there, @ a case, :word an emoji; "+" adds a block below; drag a handle (or "Move to...") to reorder. Markdown and IDE keys work. Folders ("+ Folder"; drag a note in, or "Folder:" in the note) and tags filter the list. "AI": improve, organize or summarize the note or blocks picked via "Select for AI"; preview, then "Apply" (Ctrl+Z undoes); code never changes; one AI call. Notes save on their own. Export as Markdown, image or PDF. "Public on my profile" shares a note on /u/<handle>/notes/<id> (needs a public profile). 5 XP per note, for up to 20 notes; a note that mentions a case gives the Note taker badge.`,
  },
  {
    id: 'trail',
    name: 'Study trail',
    match: /^\/trail$/,
    text: `"Build my study trail": the AI makes 5 to 7 missions from your own cases and notes, weak spot first (you need at least one case). Missions: train a case (40 XP), write a note (15), study with the timer (20), investigate a new error (15), reflect (10, "Mark as done" by hand). They tick themselves when you do them. Finishing the trail gives +100 XP and the Trailblazer badge. "Replace this trail" starts a new one.`,
  },
  {
    id: 'progress',
    name: 'Progress',
    match: /^\/progress$/,
    text: `Your level and XP bar, study streak (a day counts with 5 minutes of study), time today and in total, a one year activity graph, the skill map (mastery per bug type, "Train" the weakest), a "How to earn XP" list and ${BADGES.length} badges. Levels: ${levels} XP. XP: case 10, gym pass 30 (+15 without hints), solved case 50, note 5, study minute 1, plus trails, daily puzzles, Glitchdle, hunt, duels, interrogations, review cards, articles and events. "Find people" opens the people directory.`,
  },
  {
    id: 'study',
    name: 'Study log',
    match: /^\/study$/,
    text: `Each timer run by day: time, topic, linked case or note; week total and top topics. Edit or delete (counted time stays). "Log a session" adds past study, tagged Manual, no XP.`,
  },
  {
    id: 'profile',
    name: 'Your profile',
    match: /^\/profile$/,
    text: `Edit how others see you: display name, handle (3 to 20 lowercase letters, numbers, _ or -), a short bio, "About you" (role, headline, university, course, job, location, languages you write, what you are open to), links (GitHub, LinkedIn, website), your pixel avatar ("Shuffle" and 5 colors) and up to 3 featured badges. "Make my profile public" (needs a handle) gives you a public link /u/<handle> to copy or open; it shows your name, level, study time, activity and badges, never your email, cases or notes. "Find people" opens the directory.`,
  },
  {
    id: 'public-profile',
    name: 'Public profile',
    match: /^\/u\/[^/]+$/,
    text: `Someone's public profile (/u/<handle>, or /@handle): card, level, streak, study time, cases solved, activity graph, badges and the notes they shared. Works signed out. Your own private profile shows here as a preview only you can see.`,
  },
  {
    id: 'public-note',
    name: 'Shared note',
    match: /^\/u\/[^/]+\/notes\/[^/]+$/,
    text: `A note someone shared on their public profile. Read only.`,
  },
  {
    id: 'people',
    name: 'People directory',
    match: /^\/people$/,
    text: `"Search by handle or name" to find other students. Only public profiles show up; with no search it lists the newest ones. Open a card to see their profile.`,
  },
  {
    id: 'articles',
    name: 'Articles',
    match: /^\/articles(\/[^/]+(\/edit)?)?$/,
    text: `Community articles about bugs. Reading is public. Search, sort (New, Top likes, Most valid) and filter by tag. "Write an article": title, up to 5 tags, a body with code blocks (Write and Preview), and an optional linked case (readers only see its bug type and language); up to 5 a day. On an article: Like, Valid or Bad (not on your own), comments, and Edit or Delete for the author. XP: 20 per article, 2 per like and 5 per valid rating you get, 2 per comment. Badges: Author, Trusted.`,
  },
  {
    id: 'events',
    name: 'Events',
    match: /^\/events(\/[^/]+(\/edit)?)?$/,
    text: `Community hackathons, backend battles, challenges and study groups. Tabs Live, Upcoming, Ended. "Create an event" (title, dates from 1 hour to 30 days, rules, prizes, what each entry needs: repository, video, live demo); it can be edited until it starts. While live, "Join with your entry" (one per person, with a repo link). After it ends there are 2 days of voting (one vote per entry, never your own), then the host picks up to 3 winners for the podium. XP: entry 30, podium 120, 80 or 50, 2 per vote you get, hosting 40. Badges: Competitor, Champion, Host.`,
  },
]

const ALWAYS = `Everywhere when signed in:
- Top bar: language select (EN or PT), Lab assistant button, notifications bell (comments, likes and ratings on your articles, event joins, votes and winners; "Mark all read"), your avatar (opens your profile) and Sign out.
- Nav: Board, Daily, Glitchdle, Duel, Notes, Trail, Articles, Events, Progress. Line hunt opens from Daily, People from Progress or Profile.
- Study timer, bottom left: Start (optional topic), Pause, Reset. It survives reloads and counts toward the streak.
- New badges pop up bottom right.
- Lab assistant (this assistant): five specialists (Board analyst, Gym coach, Notes keeper, Study planner, App guide). Open or close it with the top bar button, Alt+A or Ctrl+/ (Cmd+/ on a Mac); Escape closes it. Enter sends, Shift+Enter adds a line, "New chat" starts over, and answers can have buttons that open a case, a note or a page.
- Daily AI limit: ${DAILY_AI_LIMIT.user} AI calls per account. Investigating, new gym challenges, fix checks, interrogation answers, trails and this assistant use it. Hints, review, Glitchdle, hunt and duels are free.`

const sectionText = (section) => `${section.name}: ${section.text}`

export const APP_GUIDE = `Glitch Lab is a debugging gym for programming students. It trains you to find bugs instead of handing over fixes.

${ALWAYS}

Pages:
${GUIDE_SECTIONS.map((section) => `- ${sectionText(section)}`).join('\n')}`

// The section for a path, or null for a path the guide doesn't know.
export const guideSection = (path) => GUIDE_SECTIONS.find((section) => section.match?.test(typeof path === 'string' ? path : '')) ?? null

// "Profile page": a name for the current page in prompts, so "here" means something.
export const pageName = (path) => guideSection(path)?.name ?? null

// The guide with the student's current page first, so "what can I do here?" starts from it.
export function guideFor(page) {
  const here = guideSection(page?.path)
  return here ? `The student is on this page now. ${sectionText(here)}\n\n${APP_GUIDE}` : APP_GUIDE
}
