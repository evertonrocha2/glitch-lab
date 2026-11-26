import { expect, it } from 'vitest'
import { canEnter } from '../../../shared/world/map.js'
import { arrival, roadTiles } from '../../../shared/world/roads.js'
import { HUB_ID, worldById } from '../../../shared/world/worlds.js'
import { isEnemWorld, placeIn, shownIn, visibleWorld } from './enem-worlds.js'

const town = worldById(HUB_ID)

it('shows every road in Portuguese, the same map object', () => {
  expect(visibleWorld(town, 'pt-BR')).toBe(town)
  expect(visibleWorld(worldById('floresta-js'), 'en')).toBe(worldById('floresta-js'))
})

it('walls up the town roads to ENEM regions in English and keeps the road to the Forest', () => {
  const seen = visibleWorld(town, 'en')
  expect(seen).toBe(visibleWorld(town, 'en'))
  expect(seen.roads.map((road) => road.to)).toEqual(['floresta-js'])
  for (const road of town.roads.filter((each) => isEnemWorld(each.to))) {
    for (const tile of roadTiles(town, road)) {
      expect(canEnter(seen, tile.x, tile.y), `${road.side} ${tile.x},${tile.y}`).toBe(false)
      expect(arrival(seen, tile.x, tile.y)).toBeNull()
    }
  }
  const forest = town.roads.find((road) => road.to === 'floresta-js')
  for (const tile of roadTiles(town, forest)) expect(arrival(seen, tile.x, tile.y)?.world).toBe('floresta-js')
})

it('walls up the Cave road to the Math Tower in English', () => {
  const cave = visibleWorld(worldById('caverna-sql'), 'en')
  expect(cave.roads.map((road) => road.to)).toEqual(['floresta-js'])
  expect(canEnter(cave, 31, 10)).toBe(false)
  expect(cave.rows[10][31]).toBe('#')
})

it('says which regions a locale shows', () => {
  expect(shownIn('pt-BR')('torre-matematica')).toBe(true)
  expect(shownIn('en')('torre-matematica')).toBe(false)
  expect(shownIn('en')('caverna-sql')).toBe(true)
})

it('moves a hero saved in an ENEM region to the town spawn where ENEM is hidden', () => {
  const saved = { world: 'biblioteca-linguagens', x: 3, y: 10 }
  expect(placeIn(saved, 'pt-BR')).toBe(saved)
  expect(placeIn(saved, 'en')).toEqual({ world: HUB_ID, ...town.spawn })
  const forest = { world: 'floresta-js', x: 29, y: 10 }
  expect(placeIn(forest, 'en')).toBe(forest)
})
