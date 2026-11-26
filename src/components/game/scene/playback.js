// The playback clock: how fast fights replay and how long one takes on screen. pack.js reads a fight
// log (the format lives at the top of shared/game/combat.js) into what the scene draws.

export const HURT_LAG_MS = 120 // the victim reacts this long after the swing starts
export const WALK_MS = 1500 // the hero walks this long between fights in the hunt loop
export const END_HOLD_MS = 900 // a beat after the last event before the next fight
export const ANIM_MS = { attack: 420, hurt: 260, death: 800, enrage: 700, phase: 600, idle: 0 }

export const BOSS_SPEED = 1
// Hunt packs replay at 1.5x: packs fall in a few seconds, fast enough to feel busy, slow enough to
// read each skill's effect.
export const HUNT_SPEED = 1.5

// Total playback time of a fight in ms (already divided by speed).
export function duration(fight, { speed = BOSS_SPEED } = {}) {
  const k = speed > 0 ? speed : 1
  const last = (fight?.log ?? []).reduce((max, ev) => Math.max(max, ev.t), 0)
  return (Math.max(fight?.ms ?? 0, last) + HURT_LAG_MS + ANIM_MS.death + END_HOLD_MS) / k
}
