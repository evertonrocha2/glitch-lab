import { WORLDS } from './worlds.js'

// Which worlds and zones are open, worked out fresh from the study signals (signals.js) on every
// read, like XP. Nothing about it is saved, so it can't drift from what the student really did.
// Worlds open by study (their portal's requirement); every zone inside a world is open with it.

// How much of a requirement is done.
export function haveFor(requirement, signals) {
  if (requirement.signal === 'enemCorrect') return signals.enemCorrect[requirement.area] ?? 0
  return signals.codeSolved
}

function lock(id, requirement, signals) {
  if (!requirement) return { id, unlocked: true, requirement: null, have: null, need: null }
  const have = haveFor(requirement, signals)
  return { id, unlocked: have >= requirement.count, requirement, have, need: requirement.count }
}

// { worlds: [{ id, unlocked, requirement, have, need }], zones: { [worldId]: [same, per zone] } }.
// have and need are null when there's nothing to do (always, for a zone).
export function unlocks(signals, worlds = WORLDS) {
  return {
    worlds: worlds.map((world) => lock(world.id, world.requirement, signals)),
    zones: Object.fromEntries(worlds.map((world) => [world.id, world.zones.map((zone) => lock(zone.id, null, signals))])),
  }
}

// The ids of the world's open zones, for map.js's canEnter.
export function openZones(state, worldId) {
  return new Set((state.zones[worldId] ?? []).filter((zone) => zone.unlocked).map((zone) => zone.id))
}

// The locked world closest to opening: { worldId, zoneId: null, requirement, have, need }, or null when
// every world is open. On a tie, the order of WORLDS.
export function nextGoal(state) {
  const left = (world) => world.need - world.have
  const locked = state.worlds.filter((world) => !world.unlocked)
  const best = locked.reduce((found, world) => (found && left(found) <= left(world) ? found : world), null)
  return best ? { worldId: best.id, zoneId: null, requirement: best.requirement, have: best.have, need: best.need } : null
}
