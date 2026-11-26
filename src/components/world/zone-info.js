import { DIFFICULTIES } from '../../../shared/game/enemies.js'
import { zoneRates } from '../../../shared/game/rates.js'
import { socketedSupports } from '../../../shared/game/talents.js'
import { zoneDef } from '../../../shared/game/zones.js'

// What the world tab and the zone label say about a hunt zone (fase 3): how dangerous it is for this
// hero, its suggested level and what an hour there pays, from the same rules the server pays with.

// The zone's suggested power on a difficulty: enemies scale by its mult, so the power does too.
export const suggestedPower = (zone, difficulty) => Math.round(zone.suggestedPower * DIFFICULTIES[difficulty].mult)

// How dangerous a zone is for the hero: at the suggested power it beats the boss, under 70% of it it
// does not (shared/game/zones.js), so those are the steps. Advice only: every zone is open.
export function dangerOf(power, suggested) {
  if (power >= suggested) return 'safe'
  return power >= suggested * 0.7 ? 'risky' : 'deadly'
}

// The hero as the hunt sim reads it, from the game View (what fighterOf builds on the server).
export function fighterOfView(view) {
  const hero = view.hero
  const owned = hero.skills?.owned ?? {}
  return {
    stats: view.stats,
    skills: (hero.skills?.loadout ?? []).filter(Boolean).map((id) => ({ id, level: owned[id] ?? 1 })),
    supports: socketedSupports(hero.talents ?? [], hero.treeSockets ?? {}),
    potions: hero.potions ?? { hp: 0, mp: 0 },
    thresholds: hero.thresholds ?? { hp: 0.4, mp: 0.25 },
  }
}

// { def, tier, level, danger, xpHour, goldHour } for a hunt zone, or null for safe ground. The hour is
// at today's study multiplier. Without stats (a View from before they existed) there is no estimate.
export function zoneInfo(view, worldId, zoneId, difficulty = 'normal') {
  const def = zoneDef(worldId, zoneId)
  if (!def || !view) return null
  const suggested = suggestedPower(def, difficulty)
  const rates = view.stats ? zoneRates({ fighter: fighterOfView(view), zone: def, difficulty, multiplier: view.study?.xpMultiplier ?? 1 }) : null
  return {
    def,
    tier: def.tier,
    level: Math.max(def.minLevel, DIFFICULTIES[difficulty].minLevel),
    suggested,
    danger: dangerOf(view.power ?? 0, suggested),
    xpHour: rates?.xp ?? null,
    goldHour: rates?.gold ?? null,
  }
}
