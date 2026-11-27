// The playback clock: how fast fights replay and how long one takes on screen. pack.js reads a fight
// log (the format lives at the top of shared/game/combat.js) into what the scene draws.

export const HURT_LAG_MS = 120 // the victim reacts this long after the swing starts
export const WALK_MS = 900 // the hero walks this long between fights in the hunt loop
export const END_HOLD_MS = 500 // a beat after the last event before the next fight
export const ANIM_MS = { attack: 420, hurt: 260, death: 800, enrage: 700, phase: 600, idle: 0 }

export const BOSS_SPEED = 1
// Hunt packs replay at 2x: packs fall one after another, fast enough to feel busy, slow enough to
// read each skill's effect. Boss fights replay in real time.
export const HUNT_SPEED = 2

// Keys 5 and 6: a potion drunk by hand shows only in the play of the fight it was drunk in, not when
// the hunt loop comes back to that fight. Each play is matched by when it began, give or take this
// much (the HUD and the scene keep their own clocks).
export const DRINK_SLACK_MS = 1000
// Hand drinks older than this are dropped: the play they belong to is long over.
export const DRINK_KEEP_MS = 120_000

// Whether a hand drink { fight, wall } belongs to this play of fight, which began at wall time playStart.
export const drunkIn = (drink, fight, playStart) => drink.fight === fight && drink.wall >= playStart - DRINK_SLACK_MS

// Total playback time of a fight in ms (already divided by speed).
export function duration(fight, { speed = BOSS_SPEED } = {}) {
  const k = speed > 0 ? speed : 1
  const last = (fight?.log ?? []).reduce((max, ev) => Math.max(max, ev.t), 0)
  return (Math.max(fight?.ms ?? 0, last) + HURT_LAG_MS + ANIM_MS.death + END_HOLD_MS) / k
}
