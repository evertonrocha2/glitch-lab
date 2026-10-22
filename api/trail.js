import { computeProgress } from '../shared/progress.js'
import { trailSummary, trailView } from '../shared/trails.js'
import { generateJson } from './_lib/ai/index.js'
import { clientDay, serverDay } from './_lib/days.js'
import { fail, ok, readJson, requireUser } from './_lib/http.js'
import { buildTrailPrompt, TRAIL_SCHEMA, TRAIL_SYSTEM } from './_lib/prompts/trail.js'
import { aiFailure, dailyLimitReached } from './_lib/responses.js'
import { getStore } from './_lib/store/index.js'
import { parseTrail, trailFacts } from './_lib/trails.js'
import { takeAiCall } from './_lib/usage.js'

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
  return {
    trail: active ? trailView(active, data) : null,
    history: older.slice(0, HISTORY).map((trail) => trailSummary(trailView(trail, data))),
    sources: { cases: data.cases.length, notes: data.notes.length },
  }
}

export async function GET(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  return ok(trailPage(await loadData(getStore(), auth.user.id)))
}

// Builds a new trail with the AI from the student's cases and notes. It becomes the active one.
export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const body = (await readJson(request)) ?? {}
  const store = getStore()
  const data = await loadData(store, auth.user.id)
  if (!data.cases.length) return fail(400, 'Investigate an error on your board first: your trail is built from your cases.')
  if (!(await takeAiCall(store, auth.user))) return dailyLimitReached()

  const today = clientDay(body.today) ?? serverDay()
  const progress = computeProgress({ ...data, today })
  let parsed
  try {
    const answer = await generateJson({ system: TRAIL_SYSTEM, prompt: buildTrailPrompt(trailFacts({ ...data, progress })), schema: TRAIL_SCHEMA })
    parsed = parseTrail(answer, data.cases)
  } catch (err) {
    return aiFailure(err)
  }

  const created = await store.createTrail(auth.user.id, { ...parsed, done: [] })
  return ok(trailPage({ ...data, trails: [created, ...data.trails] }), 201)
}

// { trailId, missionId, done }: ticks a reflect mission by hand. Every other kind ticks itself.
export async function PUT(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const body = await readJson(request)
  const { trailId, missionId, done } = body ?? {}
  if (typeof trailId !== 'string' || typeof missionId !== 'string' || typeof done !== 'boolean') return fail(400, 'Invalid request.')

  const store = getStore()
  const trail = await store.getTrail(auth.user.id, trailId)
  if (!trail) return fail(404, 'Trail not found.')
  const mission = trail.missions.find((item) => item.id === missionId)
  if (!mission) return fail(404, 'Mission not found.')
  if (mission.kind !== 'reflect') return fail(400, 'This mission ticks itself when you do it.')

  const updated = await store.setMissionDone(auth.user.id, trailId, missionId, done)
  const { trails, ...data } = await loadData(store, auth.user.id)
  return ok({ trail: trailView(updated, data) })
}
