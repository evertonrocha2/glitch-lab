// The skill map: how well a student knows each bug concept, from 0 to 100. Half comes from the
// review box (box 5 is the full half), the other half from practice: cases solved and challenges
// passed on that concept. Worked out from stored data, like XP.
import { MAX_BOX, REVIEW_CONCEPTS } from './review.js'

const SOLVED_POINTS = 15
const PASS_POINTS = 10
// Practice counts the first two of each, so the review half still matters.
const PRACTICE_CAP = 2

// 0 (not met yet) to 4, the same steps as the activity graph's colors.
export function masteryLevel(mastery, met) {
  if (!met) return 0
  if (mastery < 25) return 1
  if (mastery < 50) return 2
  if (mastery < 75) return 3
  return 4
}

// cases, challenges: the student's own. items: review items. puzzleConcepts: the concept of each
// daily or global puzzle passed. Returns { concepts: [...], weakest, trainCaseId }: `weakest` is the
// met concept with the lowest mastery, and `trainCaseId` one of its cases to train on (open ones first).
export function skillMap({ cases = [], challenges = [], items = [], puzzleConcepts = [] }) {
  const caseConcept = new Map(cases.map((item) => [item.id, item.concept]))
  const stored = new Map(items.map((item) => [item.concept, item]))
  const concepts = REVIEW_CONCEPTS.map((concept) => {
    const own = cases.filter((item) => item.concept === concept)
    const solved = own.filter((item) => item.status === 'solved').length
    const passes =
      challenges.filter((item) => item.status === 'passed' && item.caseId && caseConcept.get(item.caseId) === concept).length +
      puzzleConcepts.filter((id) => id === concept).length
    const item = stored.get(concept) ?? null
    const met = own.length > 0 || passes > 0 || item !== null
    const review = item ? ((item.box - 1) / (MAX_BOX - 1)) * 50 : 0
    const practice = Math.min(solved, PRACTICE_CAP) * SOLVED_POINTS + Math.min(passes, PRACTICE_CAP) * PASS_POINTS
    const mastery = met ? Math.round(review + practice) : 0
    return { concept, met, mastery, level: masteryLevel(mastery, met), box: item?.box ?? null, dueDay: item?.dueDay ?? null, cases: own.length, solved, passes }
  })

  const weakest = concepts.filter((item) => item.met).sort((a, b) => a.mastery - b.mastery || (a.dueDay ?? '').localeCompare(b.dueDay ?? ''))[0] ?? null
  const trainable = weakest ? cases.filter((item) => item.concept === weakest.concept) : []
  const train = trainable.find((item) => item.status !== 'solved') ?? trainable[0] ?? null
  return { concepts, weakest: weakest?.concept ?? null, trainCaseId: train?.id ?? null }
}
