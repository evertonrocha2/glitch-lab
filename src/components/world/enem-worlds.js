import { roadTiles } from '../../../shared/world/roads.js'
import { HUB_ID, WORLDS, worldById } from '../../../shared/world/worlds.js'

// ENEM only exists in the pt-BR UI. In any other language the ENEM regions are left out: the roads
// that lead to them are walled up like the rest of the map's edge (walking there goes nowhere), and the
// world tab skips them.

export const showsEnem = (locale) => locale === 'pt-BR'

const ENEM_IDS = new Set(WORLDS.filter((world) => world.kind === 'enem').map((world) => world.id))
export const isEnemWorld = (id) => ENEM_IDS.has(id)

// Whether this locale shows the region.
export const shownIn = (locale) => (id) => showsEnem(locale) || !isEnemWorld(id)

// The edge char the map is walled with (its top left corner: a wall or a tree).
const edgeOf = (world) => world.rows[0][0]

const closed = new Map()

// The map as this locale sees it. The same object comes back each time, so it never looks "changed".
export function visibleWorld(world, locale) {
  if (!world || showsEnem(locale) || !world.roads?.some((road) => isEnemWorld(road.to))) return world
  if (!closed.has(world.id)) {
    const gone = world.roads.filter((road) => isEnemWorld(road.to))
    const shut = new Set(gone.flatMap((road) => roadTiles(world, road).map(({ x, y }) => `${x},${y}`)))
    const rows = world.rows.map((row, y) => [...row].map((char, x) => (shut.has(`${x},${y}`) ? edgeOf(world) : char)).join(''))
    closed.set(world.id, { ...world, rows, roads: world.roads.filter((road) => !isEnemWorld(road.to)) })
  }
  return closed.get(world.id)
}

// Where a saved place lands in this locale: an ENEM region where ENEM is hidden sends the hero to the
// town's spawn.
export function placeIn(position, locale) {
  if (shownIn(locale)(position.world)) return position
  return { world: HUB_ID, ...worldById(HUB_ID).spawn }
}
