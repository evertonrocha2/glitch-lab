// Hero XP (fase 2a, part C): hunting gives XP, studying multiplies it. Pure: no I/O, no randomness.
// The hero stores its xp; the level comes from it with xpForLevel (shared/game/fuel.js).
import { DIFFICULTIES } from './enemies.js'
import { heroLevel } from './fuel.js'

// 1 + 0.1 per acerto today, capped at 3.0 (20 acertos).
export const MULTIPLIER_PER_ACERTO = 0.1
export const MULTIPLIER_CAP = 3
// An elite pays as much XP as 3 plain kills (like its gold).
export const ELITE_XP = 3
// The first win over a boss pays as much as this many plain kills in its zone.
export const BOSS_XP_KILLS = 150

const TENTHS = 10
const CAP_TENTHS = MULTIPLIER_CAP * TENTHS

// Worked out in tenths so 1 + 0.1 x 7 is exactly 1.7. A count that isn't a whole, non-negative
// number reads as no study; part of an acerto adds nothing.
export function studyMultiplier(correct) {
  const count = typeof correct === 'number' && correct > 0 ? Math.floor(correct) : 0
  return Math.min(TENTHS + count * MULTIPLIER_PER_ACERTO * TENTHS, CAP_TENTHS) / TENTHS
}

// The acertos on the client's day (the ?today= the app sends), 0 when that day has none.
export const correctToday = (ledger, today) => ledger.days.find((row) => row.day === today)?.correct ?? 0

// Floating point can land a hair under a whole number (0.7 x 1.1 x 100): round down once, at the end.
const floor = (value) => Math.floor(value + 1e-9)

// XP for a stretch of hunting: each kill pays the zone's xp, an elite ELITE_XP times that, scaled
// by the difficulty and the study multiplier that held for the stretch.
export function huntXp({ kills, elites, zone, difficulty, multiplier = 1 }) {
  const units = kills - elites + elites * ELITE_XP
  return floor(units * zone.xp * DIFFICULTIES[difficulty].mult * multiplier)
}

export const bossXp = (zone, difficulty, multiplier = 1) =>
  floor(BOSS_XP_KILLS * zone.xp * DIFFICULTIES[difficulty].mult * multiplier)

// Migration: a hero saved before XP was stored starts with the XP its study-derived level implies
// (the whole study XP, so it keeps its level and its bar). Stored XP stays as it is.
export const startingXp = (hero, studyXp) => (Number.isSafeInteger(hero.xp) && hero.xp >= 0 ? hero.xp : studyXp)

export const levelsGained = (before, after) => heroLevel(after).level - heroLevel(before).level
