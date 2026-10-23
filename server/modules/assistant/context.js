import { BADGES } from '../../../shared/badges.js'
import { conceptLabel } from '../../../shared/concepts.js'
import { computeProgress, XP } from '../../../shared/progress.js'
import { isQuestion } from '../../../shared/question.js'
import { kindLabel, trailViews } from '../../../shared/trails.js'
import { loadDaily } from '../daily/solved.js'
import { loadRiddle } from '../glitchdle/solved.js'
import { loadDuel } from '../duels/solved.js'
import { loadHunt } from '../hunt/solved.js'
import { loadInterrogation } from '../interrogation/solved.js'
import { serverDay } from '../../core/days.js'
import { guideFor } from './guide.js'
import { clip, firstLines } from './text.js'

// Characters of data one specialist gets, so prompts stay small and fast on the free tier.
export const CONTEXT_BUDGET = 6000
// The app guide is static text covering every page, so it gets more room.
export const GUIDE_BUDGET = 11_000
const MAX_CASES = 15
const MAX_CHALLENGES = 10
const MAX_NOTES = 20

const errorLine = (error) => clip(firstLines(error, 1), 160)
const errorType = (error) => /^([A-Za-z_$][\w$.]*)\s*:/.exec(firstLines(error, 1).trim())?.[1] ?? 'Error'
// A question card (from a doubt chat) has no error: its topic and question stand in.
const caseLine = (item) => (isQuestion(item) ? `question card on ${clip(item.topic, 60)}: ${clip(firstLines(item.question, 1), 140)}` : errorLine(item.error))
const caseType = (item) => (isQuestion(item) ? `question on ${clip(item.topic, 60)}` : errorType(item.error))

function duration(seconds) {
  const minutes = Math.floor(seconds / 60)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}

// Bug types among cases not solved yet, most common first.
function openByConcept(cases) {
  const counts = new Map()
  for (const item of cases) if (item.status !== 'solved') counts.set(item.concept, (counts.get(item.concept) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])
}

async function boardContext({ store, userId, page, needs }) {
  const parts = []
  if (needs.includes('case_list')) {
    const cases = await store.listCases(userId)
    const open = openByConcept(cases)
    parts.push(
      `Cases (newest first, ${Math.min(cases.length, MAX_CASES)} of ${cases.length}):`,
      ...cases.slice(0, MAX_CASES).map(
        (item) =>
          `- id ${item.id} | ${conceptLabel(item.concept)} | ${item.language} | ${item.status} | ${Math.min(item.passedCount, 2)}/2 challenges passed | ${caseLine(item)}`,
      ),
      open.length
        ? `Weak spot: ${conceptLabel(open[0][0])} (${open[0][1]} open ${open[0][1] === 1 ? 'case' : 'cases'})`
        : 'Weak spot: none yet',
      `Open cases by bug type: ${open.map(([concept, count]) => `${conceptLabel(concept)} ${count}`).join(', ') || 'none'}`,
    )
  }
  if (needs.includes('current_case') && page.caseId) {
    const item = await store.getCase(userId, page.caseId)
    // The fix and the exercise answer are left out on purpose: the student should get there.
    if (item) {
      parts.push(
        '',
        `Open case ${item.id} (${conceptLabel(item.concept)}, ${item.language}, ${item.status}):`,
        isQuestion(item) ? `Question card on ${clip(item.topic, 60)}: ${clip(firstLines(item.question, 6), 600)}` : `Error: ${clip(firstLines(item.error, 6), 600)}`,
        isQuestion(item) && item.recap ? `What the student and the tutor talked about: ${clip(item.recap, 400)}` : '',
        item.context ? `What the student was trying to do: ${clip(item.context, 300)}` : '',
        item.code ? `Code: ${clip(firstLines(item.code, 20), 900)}` : '',
        `What happened: ${clip(item.analysis?.explicacao, 500)}`,
        `Why: ${clip(item.analysis?.causa, 400)}`,
      )
    }
  }
  return parts.filter((line) => line !== '').join('\n')
}

// Only what the gym page itself shows: never the solution, the bug explanation, or hints not revealed yet.
// getChallengeSecret is never called here.
function publicChallenge(record, concept) {
  const hints = record.hints.slice(0, record.hintsRevealed)
  return [
    `- id ${record.id} | ${record.puzzleId ? 'daily or global puzzle' : `case ${record.caseId}`} (${conceptLabel(concept)}) | ${record.status} | attempts ${record.attempts} | hints revealed ${record.hintsRevealed} of ${record.hints.length}`,
    `  Symptom: ${clip(firstLines(record.symptom, 3), 200)}`,
    ...hints.map((hint, index) => `  Hint ${index + 1}: ${clip(hint, 200)}`),
  ].join('\n')
}

async function gymContext({ store, userId, page, needs }) {
  const cases = await store.listCases(userId)
  const conceptOf = (caseId) => cases.find((item) => item.id === caseId)?.concept ?? 'other'
  const parts = []
  if (needs.includes('challenge_list')) {
    const challenges = (await store.listChallenges(userId)).reverse().slice(0, MAX_CHALLENGES)
    parts.push(`Gym challenges (newest first, ${challenges.length}):`, ...challenges.map((item) => publicChallenge(item, conceptOf(item.caseId))))
  }
  if (needs.includes('current_challenge') && page.challengeId) {
    const record = await store.getChallenge(userId, page.challengeId)
    if (record) {
      parts.push(
        '',
        `Open challenge (${record.language}):`,
        publicChallenge(record, conceptOf(record.caseId)),
        `Broken code the student is fixing:\n${clip(record.brokenCode, 1500)}`,
        'You do not know the solution or the hints not revealed yet, on purpose.',
      )
    }
  }
  return parts.join('\n')
}

function noteText(note, cases) {
  return note.blocks
    .map((block) => {
      if (block.type === 'heading') return `# ${block.text}`
      if (block.type === 'todo') return `[${block.done ? 'x' : ' '}] ${block.text}`
      if (block.type === 'case') {
        const item = cases.find((kase) => kase.id === block.caseId)
        return `[case ${block.caseId}: ${item ? caseType(item) : 'no longer on the board'}]`
      }
      return block.text
    })
    .filter(Boolean)
    .join('\n')
}

async function notesContext({ store, userId, page, needs }) {
  const [notes, cases] = await Promise.all([store.listNotes(userId), store.listCases(userId)])
  const parts = []
  if (needs.includes('note_list')) {
    parts.push(
      `Notes (last edited first, ${Math.min(notes.length, MAX_NOTES)} of ${notes.length}):`,
      ...notes
        .slice(0, MAX_NOTES)
        .map((note) => `- id ${note.id} | "${clip(note.title || 'Untitled', 80)}" | ${clip(noteText(note, cases).replace(/\n/g, ' / '), 160)}`),
    )
  }
  if (needs.includes('current_note') && page.noteId) {
    const note = notes.find((item) => item.id === page.noteId)
    if (note) parts.push('', `Open note ${note.id}: "${note.title || 'Untitled'}"`, clip(noteText(note, cases), 2500))
  }
  return parts.join('\n')
}

async function studyContext({ store, userId, needs }) {
  const parts = []
  if (!needs.includes('progress') && !needs.includes('study_plan')) return ''
  const [cases, challenges, notes, study, trails, community] = await Promise.all([
    store.listCases(userId),
    store.listChallenges(userId),
    store.listNotes(userId),
    store.listStudyTime(userId),
    store.listTrails(userId),
    store.communityStats(userId),
  ])
  if (needs.includes('progress')) {
    // The same inputs as /api/progress, so the assistant never quotes a different XP.
    const [daily, riddle] = await Promise.all([loadDaily(store, userId, challenges), loadRiddle(store, userId)])
    const duel = await loadDuel(store, userId)
    // Line hunts too, so the XP matches /api/progress.
    const hunt = await loadHunt(store, userId)
    // Community events too, so the XP matches /api/progress.
    const events = await store.eventStats(userId)
    // Interrogations too, so the XP matches /api/progress.
    const interrogation = await loadInterrogation(store, userId)
    const progress = computeProgress({ cases, challenges, notes, study, today: serverDay(), trails, daily, community, riddle, hunt, duel, events, interrogation })
    const earned = new Set(progress.badges.filter((badge) => badge.earned).map((badge) => badge.id))
    const open = openByConcept(cases)
    parts.push(
      `Level ${progress.level} (${progress.title}), ${progress.xp} XP${progress.nextLevelXp ? `, next level at ${progress.nextLevelXp} XP` : ', top level'}`,
      `Study streak: ${progress.streak} days. Studied today: ${duration(progress.todaySeconds)}. Total: ${duration(progress.totalSeconds)}.`,
      `Cases: ${cases.length} (${cases.filter((item) => item.status === 'solved').length} solved). Open gym challenges: ${challenges.filter((item) => item.status === 'open').length}. Notes: ${notes.length}.`,
      `Open cases by bug type: ${open.map(([concept, count]) => `${conceptLabel(concept)} ${count}`).join(', ') || 'none'}`,
      `Badges earned: ${BADGES.filter((badge) => earned.has(badge.id)).map((badge) => badge.name).join(', ') || 'none'}`,
      `Badges locked: ${BADGES.filter((badge) => !earned.has(badge.id)).map((badge) => `${badge.name} (${badge.how})`).join('; ') || 'none'}`,
      `XP: ${XP.case} per case, ${XP.pass} per passed challenge (+${XP.cleanPass} with no hints), ${XP.solved} per solved case, ${XP.note} per note, ${XP.studyMinute} per study minute. A streak day needs 5 minutes of study.`,
    )
  }
  if (needs.includes('study_plan')) {
    // The newest study trail is the active one; its missions are checked against the data above.
    if (trails.length) {
      const view = trailViews(trails, { cases, challenges, notes, study }).get(trails[0].id)
      parts.push(
        `Study trail (/trail): "${clip(view.title, 80)}", ${view.doneCount}/${view.total} missions done, ${view.xp} of ${view.xpTotal} XP.`,
        ...view.missions.map((mission) => `- [${mission.status}] ${kindLabel(mission.kind)}: ${clip(mission.title, 80)}`),
      )
    } else {
      parts.push('No study plan saved.')
    }
  }
  return parts.join('\n')
}

// Leads with the page the student is on, so "what can I do here?" has an answer.
const guideContext = async ({ page }) => guideFor(page)

// One loader per specialist. Each reads only the signed-in student's data, only the keys it was given.
export const CONTEXT_LOADERS = {
  board: boardContext,
  gym: gymContext,
  notes: notesContext,
  study: studyContext,
  guide: guideContext,
}

export async function loadContext(name, store, userId, { page, needs }) {
  const text = await CONTEXT_LOADERS[name]({ store, userId, page, needs })
  return clip(text?.trim() || 'Nothing here yet.', name === 'guide' ? GUIDE_BUDGET : CONTEXT_BUDGET)
}
