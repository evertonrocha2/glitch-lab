import { canEnter } from '../../../shared/world/map.js'
import { HUB_ID, worldById } from '../../../shared/world/worlds.js'
import { badRequest } from '../../core/errors.js'
import { isId } from '../../core/validation.js'
import { MESSAGES, toPosition } from './world.model.js'

// Glitch World (fase 3): an open world of regions linked by roads. Nothing is locked, so the only thing
// kept here is where the hero stands, so it comes back to the same place. Hunting by standing in a zone
// is the game service's (startHunt / stopHunt), which the client calls as the hero walks.

// Whether the hero may stand there: a known region and a tile it can enter (not solid, no NPC).
function standable({ world: worldId, x, y }) {
  const world = worldById(worldId)
  return Boolean(world) && canEnter(world, x, y)
}

const spawnOf = (worldId) => ({ world: worldId, ...worldById(worldId).spawn })

// The saved place, or a spawn when it stopped being valid (a map changed): the same region's spawn
// if it still exists, else the town's. A hero saved before the regions (in the old Lab, or a portal
// tile) lands on a spawn this way too.
function placeFor(saved) {
  if (!saved) return spawnOf(HUB_ID)
  if (standable(saved)) return toPosition(saved)
  return worldById(saved.world) ? spawnOf(saved.world) : spawnOf(HUB_ID)
}

// { position }.
export async function getWorld(store, user) {
  return { position: placeFor(await store.getWorldPosition(user.id)) }
}

// { world, x, y }: only somewhere the hero could really stand.
export async function savePosition(store, user, body) {
  const { world, x, y } = body
  if (!isId(world) || !Number.isSafeInteger(x) || !Number.isSafeInteger(y)) throw badRequest()
  if (!worldById(world)) throw badRequest(MESSAGES.worldNotFound)
  if (!standable({ world, x, y })) throw badRequest(MESSAGES.badPosition)
  return { position: toPosition(await store.saveWorldPosition(user.id, { world, x, y })) }
}
