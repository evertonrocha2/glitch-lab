import { WORLDS } from './worlds.js'

// Which worlds and zones are open, worked out fresh from the study signals (signals.js) on every
// read, like XP. Nothing about it is saved, so it can't drift from what the student really did.

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
// have and need are null when there's nothing to do.
export function unlocks(signals, worlds = WORLDS) {
  return {
    worlds: worlds.map((world) => lock(world.id, world.requirement, signals)),
    zones: Object.fromEntries(worlds.map((world) => [world.id, world.zones.map((zone) => lock(zone.id, zone.requirement, signals))])),
  }
}

// The ids of the world's open zones, for map.js's canEnter.
export function openZones(state, worldId) {
  return new Set((state.zones[worldId] ?? []).filter((zone) => zone.unlocked).map((zone) => zone.id))
}

// The locked thing closest to opening: { worldId, zoneId (null for a world), requirement, have, need },
// or null when everything is open. Zones of a locked world wait for it. On a tie a world comes before
// a zone, then the order of WORLDS.
export function nextGoal(state) {
  const candidates = []
  state.worlds.forEach((world, order) => {
    if (!world.unlocked) {
      candidates.push({ goal: { worldId: world.id, zoneId: null, ...pick(world) }, order, isZone: 0 })
      return
    }
    for (const zone of state.zones[world.id] ?? []) {
      if (!zone.unlocked) candidates.push({ goal: { worldId: world.id, zoneId: zone.id, ...pick(zone) }, order, isZone: 1 })
    }
  })
  const left = ({ goal }) => goal.need - goal.have
  candidates.sort((a, b) => left(a) - left(b) || a.isZone - b.isZone || a.order - b.order)
  return candidates[0]?.goal ?? null
}

const pick = ({ requirement, have, need }) => ({ requirement, have, need })
