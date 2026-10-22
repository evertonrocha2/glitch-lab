import { CONCEPTS, conceptLabel } from '../../shared/concepts.js'
import { MISSION_XP } from '../../shared/trails.js'
import { clip, firstLines } from './assistant/text.js'

// Characters per field, and how many missions a trail keeps.
export const TRAIL_LIMITS = { title: 80, summary: 300, missionTitle: 80, description: 240, minMissions: 3, maxMissions: 7, minMinutes: 5, maxMinutes: 60 }
const MAX_CASES = 20
const MAX_NOTES = 8

const CONCEPT_IDS = new Set(CONCEPTS.map((concept) => concept.id))
// The title a trail gets when the AI leaves it blank, in the reader's language.
const FALLBACK_TITLE = { en: 'Your study trail', 'pt-BR': 'Sua trilha de estudos' }
const text = (value, max) => (typeof value === 'string' ? clip(value.trim(), max) : '')

// The bug type with the most open cases, or the most common one when everything is solved.
function weakSpot(cases) {
  const counts = new Map()
  const open = cases.filter((item) => item.status !== 'solved')
  for (const item of open.length ? open : cases) counts.set(item.concept, (counts.get(item.concept) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

const noteExcerpt = (note) =>
  note.blocks
    .filter((block) => typeof block.text === 'string' && block.text.trim())
    .map((block) => block.text.trim())
    .join(' / ')

// What the AI gets to plan with: the student's cases, weak spot, notes and progress, trimmed.
export function trailFacts({ cases, notes, progress }) {
  const counts = new Map()
  for (const item of cases) counts.set(item.concept, (counts.get(item.concept) ?? 0) + 1)
  const spot = weakSpot(cases)
  const lines = [
    `Weak spot: ${spot ? `${conceptLabel(spot)} (${spot})` : 'none yet'}`,
    `Cases by bug type: ${[...counts].map(([concept, count]) => `${conceptLabel(concept)} (${concept}) ${count}`).join(', ')}`,
    '',
    `Cases (newest first, ${Math.min(cases.length, MAX_CASES)} of ${cases.length}):`,
    ...cases
      .slice(0, MAX_CASES)
      .map(
        (item) =>
          `- id ${item.id} | ${conceptLabel(item.concept)} (${item.concept}) | ${item.language} | ${item.status} | ${Math.min(item.passedCount, 2)}/2 challenges passed | ${clip(firstLines(item.error, 1), 160)}`,
      ),
    '',
    `Notes (newest first, ${Math.min(notes.length, MAX_NOTES)} of ${notes.length}):`,
    ...(notes.length
      ? notes.slice(0, MAX_NOTES).map((note) => {
          const mentions = note.blocks.filter((block) => block.type === 'case').map((block) => block.caseId)
          const about = mentions.length ? ` (mentions case ${mentions.slice(0, 3).join(', ')})` : ''
          return `- "${clip(note.title || 'Untitled', 80)}"${about}: ${clip(noteExcerpt(note), 160) || '(empty)'}`
        })
      : ['- none yet']),
    '',
    `Progress: Level ${progress.level} (${progress.title}), ${progress.xp} XP, ${progress.streak}-day study streak, ${Math.floor(progress.totalSeconds / 60)} minutes studied in total.`,
  ]
  return lines.join('\n')
}

// Rebuilds one mission with only the fields its kind uses, or null when it can't be trusted.
function cleanMission(raw, caseById) {
  if (!raw || typeof raw !== 'object' || !(raw.kind in MISSION_XP)) return null
  const title = text(raw.title, TRAIL_LIMITS.missionTitle)
  const description = text(raw.description, TRAIL_LIMITS.description)
  if (!title || !description) return null
  const mission = { kind: raw.kind, title, description }

  if (raw.kind === 'train' || raw.kind === 'note') {
    const kase = typeof raw.caseId === 'string' ? caseById.get(raw.caseId) : undefined
    if (!kase) return null
    mission.caseId = kase.id
    mission.concept = kase.concept
  }
  if (raw.kind === 'study') {
    const minutes = Number(raw.minutes)
    if (raw.minutes == null || raw.minutes === '' || !Number.isFinite(minutes)) return null
    mission.minutes = Math.min(TRAIL_LIMITS.maxMinutes, Math.max(TRAIL_LIMITS.minMinutes, Math.round(minutes)))
  }
  if (raw.kind === 'investigate' && raw.concept != null && raw.concept !== '') {
    if (!CONCEPT_IDS.has(raw.concept)) return null
    mission.concept = raw.concept
  }
  return mission
}

// The AI's trail, checked field by field: known kinds, the student's own cases, real concepts,
// minutes in range, text trimmed and capped. XP is set here, never by the AI. Throws (a 502) when
// fewer than three missions are left.
export function parseTrail(data, cases, locale = 'en') {
  if (!data || typeof data !== 'object' || !Array.isArray(data.missions)) throw new Error('AI trail is missing missions')
  const caseById = new Map(cases.map((item) => [item.id, item]))
  const missions = data.missions
    .map((raw) => cleanMission(raw, caseById))
    .filter(Boolean)
    .slice(0, TRAIL_LIMITS.maxMissions)
    .map((mission, index) => ({ id: `m${index + 1}`, ...mission, xp: MISSION_XP[mission.kind] }))
  if (missions.length < TRAIL_LIMITS.minMissions) throw new Error('AI trail has too few usable missions')
  return {
    title: text(data.title, TRAIL_LIMITS.title) || (FALLBACK_TITLE[locale] ?? FALLBACK_TITLE.en),
    summary: text(data.summary, TRAIL_LIMITS.summary),
    missions,
  }
}
