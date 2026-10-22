// Study trails: an AI-built list of missions from the student's own cases and notes.
// Only the hand-ticked "reflect" missions are stored; every other mission is done when the data says so.

export const TRAIL_KINDS = [
  { id: 'train', label: 'Train', xp: 40, how: 'Pass a gym challenge on this case.' },
  { id: 'note', label: 'Write', xp: 15, how: 'Write a note that mentions this case.' },
  { id: 'study', label: 'Study', xp: 20, how: 'Study with the timer.' },
  { id: 'investigate', label: 'Investigate', xp: 15, how: 'Investigate a new error.' },
  { id: 'reflect', label: 'Reflect', xp: 10, how: 'Think it over, then mark it done.' },
]

// XP is fixed per kind on the server; the AI never decides it.
export const MISSION_XP = Object.fromEntries(TRAIL_KINDS.map((kind) => [kind.id, kind.xp]))
export const TRAIL_BONUS_XP = 100

export const kindLabel = (id) => TRAIL_KINDS.find((kind) => kind.id === id)?.label ?? 'Mission'

// The trail's first day. Study days are the student's local date, so this can be off by a few hours: fine.
const startDay = (trail) => trail.createdAt.slice(0, 10)

// A trail counts activity from its start until the next trail starts (until, ms; null = still active).
// Without that end, one gym pass would tick the same mission on every old trail and pay XP each time.
const studiedSeconds = (trail, study, until = null) => {
  const lastDay = until === null ? null : new Date(until).toISOString().slice(0, 10)
  return study
    .filter((entry) => entry.day >= startDay(trail) && (lastDay === null || entry.day < lastDay))
    .reduce((sum, entry) => sum + entry.seconds, 0)
}

// Study missions share the same clock, so each one needs its own minutes on top of the ones before it.
function studyGoalSeconds(mission, trail) {
  let total = 0
  for (const item of trail.missions) {
    if (item.kind !== 'study') continue
    total += (item.minutes ?? 0) * 60
    if (item.id === mission.id) break
  }
  return total
}

export function missionDone(mission, trail, { cases, challenges, notes, study }, until = null) {
  const since = Date.parse(trail.createdAt)
  // Supabase and the JSON file write timestamps differently, so compare times, not strings.
  const inWindow = (iso) => {
    const time = Date.parse(iso)
    return time >= since && (until === null || time < until)
  }
  switch (mission.kind) {
    case 'train':
      // When it was passed, not opened: a challenge started before the trail still counts once passed during it.
      return challenges.some((item) => item.caseId === mission.caseId && item.status === 'passed' && inWindow(item.passedAt ?? item.createdAt))
    case 'note':
      return notes.some((note) => inWindow(note.updatedAt) && note.blocks.some((block) => block.type === 'case' && block.caseId === mission.caseId))
    case 'study':
      return studiedSeconds(trail, study, until) >= studyGoalSeconds(mission, trail)
    case 'investigate':
      return cases.some((item) => inWindow(item.createdAt) && (!mission.concept || item.concept === mission.concept))
    case 'reflect':
      return trail.done.includes(mission.id)
    default:
      return false
  }
}

// What the page shows: each mission with its status (done / next / todo), plus counts and XP.
// data is { cases, challenges, notes, study } for the same student.
export function trailView(trail, data, until = null) {
  let nextFound = false
  const studied = studiedSeconds(trail, data.study, until)
  const missions = trail.missions.map((mission) => {
    const done = missionDone(mission, trail, data, until)
    const status = done ? 'done' : nextFound ? 'todo' : 'next'
    if (!done) nextFound = true
    const view = { ...mission, xp: MISSION_XP[mission.kind] ?? 0, status }
    if (mission.kind === 'study') {
      // Minutes counted toward this mission: what's left after the study missions before it.
      const before = studyGoalSeconds(mission, trail) - (mission.minutes ?? 0) * 60
      view.studiedMinutes = Math.min(mission.minutes ?? 0, Math.max(0, Math.floor((studied - before) / 60)))
    }
    return view
  })
  const doneCount = missions.filter((mission) => mission.status === 'done').length
  const complete = missions.length > 0 && doneCount === missions.length
  const earned = missions.filter((mission) => mission.status === 'done').reduce((sum, mission) => sum + mission.xp, 0)
  return {
    id: trail.id,
    title: trail.title,
    summary: trail.summary,
    createdAt: trail.createdAt,
    missions,
    doneCount,
    total: missions.length,
    complete,
    xp: earned + (complete ? TRAIL_BONUS_XP : 0),
    xpTotal: missions.reduce((sum, mission) => sum + mission.xp, 0) + TRAIL_BONUS_XP,
  }
}

export const trailXp = (trail, data) => trailView(trail, data).xp

// Views for every trail, each closed when the next one starts. Map of trail id -> view.
export function trailViews(trails, data) {
  const ordered = [...trails].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  return new Map(ordered.map((trail, index) => [trail.id, trailView(trail, data, ordered[index + 1] ? Date.parse(ordered[index + 1].createdAt) : null)]))
}

// The short form for older trails.
export const trailSummary = ({ id, title, createdAt, doneCount, total, complete }) => ({ id, title, createdAt, doneCount, total, complete })
