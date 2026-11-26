// The Forest's hunting zones and how they open. suggestedPower is tuned against the combat sim: a hero at it
// beats the boss, a hero at 70% of it does not. xp is what one plain kill pays (shared/game/xp.js), tuned so
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

const FINAL = 'z3'
const ORDER = ['normal', 'pesadelo', 'inferno']
const done = (progress, worldId, difficulty) => progress?.[worldId]?.[difficulty] ?? []

// progress: { [worldId]: { normal: string[], pesadelo: [], inferno: [] } } (beaten zone ids)
const difficultyOpen = (progress, worldId, difficulty) => {
  const at = ORDER.indexOf(difficulty)
  if (at <= 0) return at === 0
  return done(progress, worldId, ORDER[at - 1]).includes(FINAL)
}

export function zoneState(progress, worldId, difficulty, level) {
  const zones = ZONES[worldId]
  if (!zones || !DIFFICULTIES[difficulty]) return []
  const open = difficultyOpen(progress, worldId, difficulty)
  const beaten = done(progress, worldId, difficulty)
  const list = Object.values(zones)
  return list.map((zone, i) => {
    const levelOk = level >= Math.max(zone.minLevel, DIFFICULTIES[difficulty].minLevel)
    const prevBeaten = i === 0 || beaten.includes(list[i - 1].id)
    return {
      id: zone.id,
      unlocked: open && prevBeaten && levelOk,
      beaten: beaten.includes(zone.id),
      minLevel: zone.minLevel,
      bossLevel: zone.bossLevel,
    }
  })
}
