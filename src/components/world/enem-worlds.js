import { WORLDS } from '../../../shared/world/worlds.js'

// ENEM only exists in the pt-BR UI. In any other language the ENEM worlds are left out: the hub draws
// their portals as plain floor (walking onto one does nothing) and the world list skips them.

export const showsEnem = (locale) => locale === 'pt-BR'

const ENEM_IDS = new Set(WORLDS.filter((world) => world.kind === 'enem').map((world) => world.id))
export const isEnemWorld = (id) => ENEM_IDS.has(id)

// The floor a hidden portal turns into: a floor tile beside it, else the hub's floor.
function floorBeside(world, x, y) {
  const near = [world.rows[y]?.[x - 1], world.rows[y]?.[x + 1], world.rows[y - 1]?.[x], world.rows[y + 1]?.[x]]
  return near.find((char) => char === '_' || char === '.') ?? '_'
}

const hidden = new Map()

// The map as this locale sees it. The same object comes back each time, so it never looks "changed".
export function visibleWorld(world, locale) {
  if (showsEnem(locale) || !world.portals.some((portal) => isEnemWorld(portal.to))) return world
  if (!hidden.has(world.id)) {
    const gone = world.portals.filter((portal) => isEnemWorld(portal.to))
    const rows = world.rows.map((row, y) =>
      [...row].map((char, x) => (gone.some((portal) => portal.x === x && portal.y === y) ? floorBeside(world, x, y) : char)).join(''),
    )
    hidden.set(world.id, { ...world, rows, portals: world.portals.filter((portal) => !isEnemWorld(portal.to)) })
  }
  return hidden.get(world.id)
}
