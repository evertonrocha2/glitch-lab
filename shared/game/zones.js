// The Forest's hunting zones, all open from the start. suggestedPower is tuned against the combat sim:
// a hero at it beats the boss, a hero at 70% of it does not. xp is what one plain kill pays (shared/game/xp.js), tuned so
// a hero with no study goes from level 5 to about 10 in about 2 hours of hunting (tests/shared/game-xp.test.js).
import { DIFFICULTIES } from './enemies.js'
import { FLORESTA_JS } from '../world/maps/floresta-js.js'

export { enemyFor, packFor } from './enemies.js'

export const HUNT_WORLDS = ['floresta-js']

const [Z2_RECT, Z3_RECT] = FLORESTA_JS.zones.map((zone) => zone.rect)

export const ZONES = {
  'floresta-js': {
    z1: {
      id: 'z1', name: 'clareira', minLevel: 1, ilvl: 1, gold: 4, xp: 0.7, pack: [3, 4], spawnMs: 13000, elitePacks: 3,
      rect: { x: 0, y: 0, w: 11, h: 20 },
      enemies: ['slime', 'cogumelo-bug', 'morcego-bug', 'goblin-loop'],
      boss: 'rei-slime', bossLevel: 5, suggestedPower: 130,
    },
    z2: {
      id: 'z2', name: 'copas', minLevel: 8, ilvl: 8, gold: 9, xp: 1.1, pack: [3, 5], spawnMs: 16800, elitePacks: 3,
      rect: Z2_RECT,
      enemies: ['lobo-syntax', 'mosca-null', 'aranha-fio', 'esqueleto-array'],
      boss: 'aranha-assincrona', bossLevel: 10, suggestedPower: 260,
    },
    z3: {
      id: 'z3', name: 'raizes', minLevel: 14, ilvl: 14, gold: 16, xp: 1.6, pack: [4, 6], spawnMs: 21000, elitePacks: 2,
      rect: Z3_RECT,
      enemies: ['golem-if', 'espectro-callback', 'esqueleto-array', 'aranha-fio'],
      boss: 'hidra-undefined', bossLevel: 14, suggestedPower: 400,
    },
  },
}

// progress: { [worldId]: { normal: string[], pesadelo: [], inferno: [] } } (beaten zone ids).
// Every zone of every difficulty is open from the start: danger is the only limit. A weak hero just
// dies or earns little. minLevel (the zone's suggested level) and bossLevel stay as guidance.
export function zoneState(progress, worldId, difficulty, _level) {
  const zones = ZONES[worldId]
  if (!zones || !DIFFICULTIES[difficulty]) return []
  const beaten = progress?.[worldId]?.[difficulty] ?? []
  return Object.values(zones).map((zone) => ({
    id: zone.id,
    unlocked: true,
    beaten: beaten.includes(zone.id),
    minLevel: zone.minLevel,
    bossLevel: zone.bossLevel,
  }))
}
