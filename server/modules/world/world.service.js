import { HUNT_WORLDS } from '../../../shared/game/zones.js'
import { besidePortal, canEnter } from '../../../shared/world/map.js'
import { worldSignals } from '../../../shared/world/signals.js'
import { openZones, unlocks } from '../../../shared/world/unlocks.js'
import { HUB_ID, worldById } from '../../../shared/world/worlds.js'
import { badRequest } from '../../core/errors.js'
import { isId } from '../../core/validation.js'
import { loadDaily } from '../daily/solved.js'
import { loadRiddle } from '../glitchdle/solved.js'
import { loadHunt } from '../hunt/solved.js'
import { MESSAGES, toPosition } from './world.model.js'

// Glitch World: which worlds and zones the student's study opened, and where their hero stands.
// Unlocks are worked out on every read from what's already saved (like getProgress); only the
// position is stored, and only so the hero comes back to the same place.

async function loadUnlocks(store, userId) {
  const [examSummary, challenges, riddle, hunt] = await Promise.all([
    store.summarizeExamAttempts(userId, 'enem'),
    store.listChallenges(userId),
    loadRiddle(store, userId),
    loadHunt(store, userId),
  ])
  const daily = await loadDaily(store, userId, challenges)
  const signals = worldSignals({ examSummary, challenges, daily, riddle, hunt })
  return { signals, state: unlocks(signals) }
}

const isOpen = (state, worldId) => state.worlds.some((world) => world.id === worldId && world.unlocked)

// Whether the hero may stand there: a known, open world and a tile it can enter with the open zones.
function standable(state, { world: worldId, x, y }) {
  const world = worldById(worldId)
  return Boolean(world) && isOpen(state, worldId) && canEnter(world, x, y, openZones(state, worldId))
}

const spawnOf = (worldId) => ({ world: worldId, ...worldById(worldId).spawn })

// The saved place, or a spawn when it stopped being valid (a map changed, or a zone locked again
// because a question was removed): the same world's spawn if it's still open, else the hub's.
// A hunt world isn't walked: a hero saved inside one comes back on the hub tile beside its portal.
function placeFor(state, saved) {
  if (!saved) return spawnOf(HUB_ID)
  if (HUNT_WORLDS.includes(saved.world)) return { world: HUB_ID, ...besidePortal(worldById(HUB_ID), saved.world) }
  if (standable(state, saved)) return toPosition(saved)
  return worldById(saved.world) && isOpen(state, saved.world) ? spawnOf(saved.world) : spawnOf(HUB_ID)
}

// { worlds, zones, signals, position }. worlds and zones come from shared/world/unlocks.js.
export async function getWorld(store, user) {
  const [{ signals, state }, saved] = await Promise.all([loadUnlocks(store, user.id), store.getWorldPosition(user.id)])
  return { ...state, signals, position: placeFor(state, saved) }
}

// { world, x, y }: only somewhere the hero could really walk to right now.
export async function savePosition(store, user, body) {
  const { world, x, y } = body
  if (!isId(world) || !Number.isSafeInteger(x) || !Number.isSafeInteger(y)) throw badRequest()
  if (!worldById(world)) throw badRequest(MESSAGES.worldNotFound)
  const { state } = await loadUnlocks(store, user.id)
  if (!isOpen(state, world)) throw badRequest(MESSAGES.worldLocked)
  if (!standable(state, { world, x, y })) throw badRequest(MESSAGES.badPosition)
  return { position: toPosition(await store.saveWorldPosition(user.id, { world, x, y })) }
}
