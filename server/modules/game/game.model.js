import { ACERTO_POINTS_CAP, pendingStudy, studyRewards } from '../../../shared/game/fuel.js'
import { heroStats, power } from '../../../shared/game/stats.js'
import { HUNT_WORLDS, zoneState } from '../../../shared/game/zones.js'
import { DIFFICULTIES } from '../../../shared/game/enemies.js'

// The message texts are part of the API: the client translates them by exact text
// (src/lib/i18n/messages/server.js).
export const MESSAGES = {
  conflict: 'Your hero changed in another tab. Reload to continue.',
  zoneLocked: 'This zone is still locked.',
  bossLevel: 'Your hero needs a higher level for this boss.',
  badItem: "That item can't be used for this.",
  bagFull: 'Your bag is full.',
  noGold: 'Not enough gold.',
  noFragments: 'Not enough knowledge fragments.',
  noScrap: 'Not enough scrap.',
  noChest: 'You have no chest to open.',
  skillLocked: 'Your hero needs a higher level for this skill.',
  notOwned: "Your hero doesn't have this skill yet.",
  owned: 'Your hero already has this skill.',
  badLoadout: 'Pick skills your hero has, each one once.',
  maxLevel: 'This is already at its max level.',
  talent: "You can't take that talent.",
}

// A new player's hero. Only the server writes it: the client sends intents, never results.
export const newHero = () => ({
  gold: 0,
  fragments: 0,
  scrap: 0,
  honor: 0,
  keys: 0,
  chests: [], // [{ day, boost }]
  potions: { hp: 3, mp: 0 },
  thresholds: { hp: 0.4, mp: 0.25 },
  talents: ['root'],
  skills: { owned: { golpe: 1 }, loadout: ['golpe', null, null, null] },
  items: [], // gear and gems; equipped gear carries equipped: slot
  hunt: null, // { world, zone, difficulty, startedAt, seed, claims }
  progress: {}, // { [worldId]: { normal: [zoneId], pesadelo: [], inferno: [] } }
  look: { hood: 0, outfit: 0, hair: 0 },
  claimed: {}, // per day, as pendingStudy reads it
  lastAway: null,
})

// A saved hero with any field added after it was saved filled in from newHero.
export const withDefaults = (data) => ({ ...newHero(), ...data })

export const equippedOf = (hero) => hero.items.filter((item) => item.equipped)

export const statsOf = (hero, level) =>
  heroStats({ level, items: equippedOf(hero), talents: hero.talents })

// What combat and the hunt read: final stats, the loadout with its levels, potions and thresholds.
export const fighterOf = (hero, level) => ({
  stats: statsOf(hero, level),
  skills: hero.skills.loadout.filter(Boolean).map((id) => ({ id, level: hero.skills.owned[id] ?? 1 })),
  potions: hero.potions,
  thresholds: hero.thresholds,
})

const ACERTOS_PER_POINT = 10

// pendingStudy without its per-day breakdown (that's for recording claims).
export const pendingTotals = ({ fragments, potions, chests, keys, honor }) => ({ fragments, potions, chests, keys, honor })

// The hero as the client sees it: the hunt seed and the claimed ledger stay on the server.
function publicHero(hero) {
  const { claimed: _claimed, hunt, ...rest } = hero
  if (!hunt) return { ...rest, hunt: null }
  const { seed: _seed, ...publicHunt } = hunt
  return { ...rest, hunt: publicHunt }
}

// ctx: { fuel: { ledger, level, talentPoints }, today, huntPreview }.
export function toView(hero, { fuel, today, huntPreview = null }) {
  const level = fuel.level.level
  const stats = statsOf(hero, level)
  const spent = hero.talents.filter((id) => id !== 'root').length
  const total = fuel.talentPoints
  const zones = Object.fromEntries(
    HUNT_WORLDS.map((worldId) => [
      worldId,
      Object.fromEntries(Object.keys(DIFFICULTIES).map((difficulty) => [difficulty, zoneState(hero.progress, worldId, difficulty, level)])),
    ]),
  )
  const totalCorrect = fuel.ledger.totals.correct
  const capped = Math.floor(totalCorrect / ACERTOS_PER_POINT) >= ACERTO_POINTS_CAP
  return {
    hero: publicHero(hero),
    level: fuel.level,
    talentPoints: { total, spent, free: Math.max(0, total - spent) },
    stats,
    power: power(stats),
    zones,
    study: {
      today: {
        correct: fuel.ledger.days.find((row) => row.day === today)?.correct ?? 0,
        toNextPoint: capped ? null : ACERTOS_PER_POINT - (totalCorrect % ACERTOS_PER_POINT),
      },
      pending: pendingTotals(pendingStudy(studyRewards(fuel.ledger), hero.claimed)),
      // Correct answers per tree branch (the user's own counters): the tree shows keystone progress.
      branch: { ...fuel.ledger.branch },
    },
    huntPreview,
  }
}
