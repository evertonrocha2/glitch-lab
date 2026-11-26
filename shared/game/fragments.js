// Knowledge fragments from monsters (fase 4). Study stays the main source (fuel.js); a hunt adds a
// trickle: a plain kill drops 1 now and then, an elite 1 to 3 twice as often, both FRAGMENT_TIER_STEP
// more likely each tier. That is about 40 an hour in tier 1 at its level, 65 in tier 2 and 100 in tier 3
// (tests/shared/game-hunt-fill.test.js). The luck elixir raises both chances. A boss win pays
// BOSS_FIRST_FRAGMENTS the first time, then BOSS_FRAGMENTS once a day (game.service.js fightBoss).
// Pure and deterministic: every roll comes from the rng it is given.

export const FRAGMENT_CHANCE = 0.05
export const ELITE_FRAGMENT_CHANCE = 0.1
export const FRAGMENT_TIER_STEP = 1.6
export const ELITE_FRAGMENTS = [1, 3]
export const BOSS_FRAGMENTS = 10
export const BOSS_FIRST_FRAGMENTS = 30

// The chance one kill drops fragments, 0 to 1. tier: the zone's tier (1 to 3). luck: the luck elixir's
// bonus over the stretch (0 without it).
export function fragmentChance({ tier = 1, elite = false, luck = 0 }) {
  const base = elite ? ELITE_FRAGMENT_CHANCE : FRAGMENT_CHANCE
  return Math.min(1, base * FRAGMENT_TIER_STEP ** Math.max(0, tier - 1) * (1 + Math.max(0, luck)))
}

// What one kill drops: 0, 1 for a plain kill, 1 to 3 for an elite. One draw, plus one for an elite's amount.
export function rollFragments(rng, { tier = 1, elite = false, luck = 0 }) {
  if (!rng.chance(fragmentChance({ tier, elite, luck }))) return 0
  const [min, max] = ELITE_FRAGMENTS
  return elite ? min + rng.int(max - min + 1) : 1
}

// What a stretch of hunting pays: the fragments its kills drop on average (elites 2 each when they
// drop), the whole part for sure and the rest as one roll. Like the kills themselves (hunt.js), an
// average keeps an hour's pay steady instead of swinging with hundreds of tiny rolls.
export function huntFragments(rng, { kills, elites, tier = 1, luck = 0 }) {
  const [min, max] = ELITE_FRAGMENTS
  const expected = (kills - elites) * fragmentChance({ tier, luck }) + elites * fragmentChance({ tier, elite: true, luck }) * ((min + max) / 2)
  const whole = Math.floor(expected + 1e-9)
  return whole + (rng.chance(expected - whole) ? 1 : 0)
}

// A shown sample fight with its fragment drops marked: a { t, who: 'enemy', type: 'fragment', src,
// amount } event right after each death that dropped some (combat.js documents the log). Cosmetic: the
// hunt pays the fragments it rolls over every kill, not these.
export function markFragments(fight, rng, { tier = 1, luck = 0 } = {}) {
  const elites = new Set((fight.log ?? []).filter((ev) => ev.type === 'spawn' && ev.elite).map((ev) => ev.src))
  const log = []
  for (const ev of fight.log ?? []) {
    log.push(ev)
    if (ev.type !== 'death' || ev.who !== 'enemy') continue
    const amount = rollFragments(rng, { tier, elite: elites.has(ev.src), luck })
    if (amount > 0) log.push({ t: ev.t, who: 'enemy', type: 'fragment', src: ev.src, amount })
  }
  return { ...fight, log }
}
