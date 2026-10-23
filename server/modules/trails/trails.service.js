import { computeProgress } from '../../../shared/progress.js'
import { trailSummary, trailView, trailViews } from '../../../shared/trails.js'
import { badRequest, conflict, notFound } from '../../core/errors.js'
import { withAi } from '../../infra/ai/failure.js'
import { spendAiCall } from '../../infra/ai/quota.js'
import { buildTrailPrompt, TRAIL_SCHEMA, trailSystem } from './trail.prompt.js'
import { parseTrail, trailFacts } from './trails.model.js'

const HISTORY = 5

async function loadData(store, userId) {
  const [cases, challenges, notes, study, trails] = await Promise.all([
    store.listCases(userId),
    store.listChallenges(userId),
    store.listNotes(userId),
    store.listStudyTime(userId),
    store.listTrails(userId),
  ])
  return { cases, challenges, notes, study, trails }
}

// The newest trail is the active one, worked out against the data; older ones come back short.
function trailPage({ trails, ...data }) {
  const [active, ...older] = trails
  // Each older trail is frozen when the next one starts, so it keeps the progress it had.
  const views = trailViews(trails, data)
  return {
    trail: active ? views.get(active.id) : null,
    history: older.slice(0, HISTORY).map((trail) => trailSummary(views.get(trail.id))),
    sources: { cases: data.cases.length, notes: data.notes.length },
  }
}

export async function getTrailPage(store, user) {
  return trailPage(await loadData(store, user.id))
}

// Builds a new trail with the AI from the student's cases and notes. It becomes the active one.
export async function buildTrail({ store, ai }, user, today, locale) {
  const data = await loadData(store, user.id)
  if (!data.cases.length) throw badRequest('Investigate an error on your board first: your trail is built from your cases.')
  await spendAiCall(store, user)

  const progress = computeProgress({ ...data, today })
  // Titles and mission texts are written in the reader's language and saved that way.
  const parsed = await withAi(async () => {
    const answer = await ai.generateJson({ system: trailSystem(locale), prompt: buildTrailPrompt(trailFacts({ ...data, progress }), locale), schema: TRAIL_SCHEMA })
    return parseTrail(answer, data.cases, locale)
  })

  const created = await store.createTrail(user.id, { ...parsed, done: [] })
  return trailPage({ ...data, trails: [created, ...data.trails] })
}

// Ticks a reflect mission by hand ({ done }). Every other kind ticks itself.
export async function setMissionDone(store, user, trailId, missionId, body) {
  const done = body?.done
  if (typeof trailId !== 'string' || typeof missionId !== 'string' || typeof done !== 'boolean') throw badRequest()

  const trail = await store.getTrail(user.id, trailId)
  if (!trail) throw notFound('Trail not found.')
  const mission = trail.missions.find((item) => item.id === missionId)
  if (!mission) throw notFound('Mission not found.')
  if (mission.kind !== 'reflect') throw badRequest('This mission ticks itself when you do it.')
  const [newest] = await store.listTrails(user.id)
  if (newest?.id !== trailId) throw conflict('This trail is finished. Tick missions on your current trail.')

  const updated = await store.setMissionDone(user.id, trailId, missionId, done)
  const { trails, ...data } = await loadData(store, user.id)
  return trailView(updated, data)
}
