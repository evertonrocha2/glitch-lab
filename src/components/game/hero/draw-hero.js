import { normalizeLook } from '../../../../shared/game/look.js'
import { drawableGear } from './gear.js'
import { painter, render } from './painter.js'
import { BY_R, HAIR, HAIR_STYLES, INK, OUTFIT, RANK, SKIN } from './palette.js'
import { amulet, arm, cape, chest, hand, legs, offhand, pauldrons, relic, slash, sparkle, tunic, weapon } from './parts.js'
import { face, hairBack, hairFront, helm } from './parts-head.js'

export { SPRITE } from './painter.js'

// Where the weapon points at rest, per base (radians, negative = up).
const IDLE_ANGLE = { espada: -1.05, cajado: -1.15, martelo: -0.95 }

// bob: body drop; lean: torso shift; hand/back: front and back hand; a: weapon angle; face: pose
// face; front: the weapon is drawn over the head (wind up); slash: [frac, a0, a1, alpha] of the arc;
// stance: feet spread; outline: ink color; head: extra head shift.
export const POSES = {
  idle0: { bob: 0, lean: 0, hand: [22, 24], back: [9, 24] },
  idle1: { bob: 1, lean: 0, hand: [22, 24], back: [9, 24] },
  atk1: { bob: 0, lean: -1, hand: [26, 15], back: [10, 23], a: -1.75, face: 'determinado', front: true },
  atk2: { bob: 0, lean: 2, hand: [27, 19], back: [10, 22], a: 0.12, face: 'determinado', slash: [1, -2.0, 0.55, 1], stance: 1 },
  atk3: { bob: 1, lean: 2, hand: [25, 24], back: [10, 23], a: 0.75, face: 'determinado', slash: [1, -0.9, 1.0, 0.45], stance: 1 },
  hurt: { bob: 0, lean: -2, hand: [21, 22], back: [9, 22], a: -1.9, face: 'dor', outline: '#5c0f1c', head: -1 },
}

const HURT_FX = [[29, 10, '#ffffff'], [30, 9, '#ffd76a'], [28, 9, '#ffd76a'], [31, 12, '#ff5a6e'], [27, 13, '#ff5a6e'], [30, 11, '#ffffff'], [26, 4, '#7fe9ff']]

// A painter with the look's skin, hair and outfit colors, plus the look and gear made safe to draw.
function setup(rawLook, rawGear) {
  const look = normalizeLook(rawLook)
  const gear = drawableGear(rawGear)
  const d = painter()
  d.mats = { skin: SKIN[look.skin].t, hair: HAIR[look.hairColor], cloth: OUTFIT[look.outfit] }
  return { d, look, gear, hairStyle: HAIR_STYLES[look.hairStyle] }
}

// Epic or better armor comes with a cape in its rarity.
const capeRarity = (gear) => (gear.chest?.b === 'armadura' && RANK[gear.chest.r] >= 3 ? gear.chest.r : null)

// The hero as a SPRITE.w x SPRITE.h canvas. look: the six look indexes (anything else is normalized);
// gear: { [slot]: { b, r } } (unknown bases are skipped); pose: a POSES key (unknown -> idle0).
// The approved art has no time based motion, so `t` is accepted for callers but not used.
export function paintHero(rawLook, rawGear, pose = 'idle0', _opts = {}) {
  const P = POSES[pose] || POSES.idle0
  const { d, look, gear, hairStyle } = setup(rawLook, rawGear)
  const hidesHair = gear.helm?.b === 'capuz'
  // 1. Back layer: cape, back hair, the dev vest hood, the back arm behind the torso.
  d.dx = P.lean
  d.dy = P.bob
  const capeR = capeRarity(gear)
  if (capeR) cape(d, capeR)
  if (!hidesHair) hairBack(d, hairStyle)
  if (gear.chest?.b === 'colete-de-dev') {
    d.part = 'hoodback'
    d.circ(16, 17.2, 6.5, 2.4, 'hoodie')
  }
  arm(d, 11.5, 19, P.back[0], P.back[1], 'B')
  hand(d, P.back[0], P.back[1], 'B')
  // 2. Legs and boots stay planted.
  d.dx = 0
  d.dy = 0
  legs(d, gear, P.stance || 0)
  // 3. Torso and chest.
  d.dx = P.lean
  d.dy = P.bob
  tunic(d)
  if (gear.chest) chest(d, gear.chest)
  amulet(d, gear.amulet)
  // 4. Offhand, front arm, weapon, front hand, ring glint.
  if (gear.offhand) offhand(d, gear.offhand, P.back[0], P.back[1])
  arm(d, 20.5, 19, P.hand[0], P.hand[1], 'F')
  pauldrons(d, gear.chest)
  if (gear.weapon && !P.front) weapon(d, gear.weapon, P.hand[0], P.hand[1], P.a ?? IDLE_ANGLE[gear.weapon.b])
  if (!P.front) hand(d, P.hand[0], P.hand[1], 'F')
  if (gear.ring) d.set(P.hand[0], P.hand[1] - 1, 'ring', { c: BY_R.trim[gear.ring.r][2] })
  // 5. Head, face, hair, helm; a wind up draws the weapon over the head.
  d.dx = P.lean + (P.head || 0)
  d.part = 'head'
  d.circ(16, 10.5, 7.5, 7.2, 'skin')
  d.part = 'ear'
  d.rect(7, 11, 2, 2, 'skin')
  d.shade(8, 12, 0)
  face(d, look, P.face)
  d.part = 'head'
  if (gear.helm?.b === 'capacete-de-ferro') {
    // Long hair shows below the iron helm.
    if (hairStyle === 'longo' || hairStyle === 'cacheado') {
      d.part = 'hair'
      d.rect(8, 9, 2, 7, 'hair')
      d.rect(23, 9, 2, 4, 'hair')
    }
  } else hairFront(d, hairStyle)
  if (gear.helm) helm(d, gear.helm)
  if (P.front) {
    d.dx = P.lean
    if (gear.weapon) weapon(d, gear.weapon, P.hand[0], P.hand[1], P.a)
    hand(d, P.hand[0], P.hand[1], 'F')
  }
  // 6. Relic and effects: swing arc, hurt stars, legendary sparkles and aura.
  if (gear.relic) relic(d, gear.relic, pose === 'idle1' ? 1 : 0)
  d.dx = P.lean
  d.dy = P.bob
  if (P.slash && gear.weapon) slash(d, P.slash[0], gear.weapon.r, P.slash[1], P.slash[2], P.slash[3])
  if (pose === 'hurt') {
    for (const [x, y, c] of HURT_FX) d.fxp(x, y, c)
    d.fxp(25, 6, '#7fe9ff')
    d.fxp(25, 7, '#4fa3ff')
  }
  const legendary = Object.values(gear).filter((g) => g.r === 'legendary').length >= 3
  if (legendary) {
    sparkle(d, -2, 14, true)
    sparkle(d, 30, 4, false)
    sparkle(d, 4, 28, false)
    sparkle(d, 28, 27, true)
  }
  return render(d, { outline: P.outline || INK, aura: legendary ? '#ff9a1f' : null })
}

const SOUL = [[16, 2, '#c4fff1', 0.9], [17, 1, '#c4fff1', 0.85], [16, 0, '#7fe9ff', 0.7], [17, -1, '#7fe9ff', 0.55], [16, -2, '#4fd1c5', 0.4], [15, 1, '#7fe9ff', 0.6], [18, 2, '#7fe9ff', 0.6], [17, 2, '#ffffff', 0.9]]

// Death: knocked out on the knees, slumped forward, x eyes, weapon on the ground, a soul wisp leaving.
export function paintHeroDead(rawLook, rawGear) {
  const { d, look, gear, hairStyle } = setup(rawLook, rawGear)
  if (gear.weapon) {
    d.dx = 0
    d.dy = 0
    weapon(d, gear.weapon, 24, 31, -0.04)
  }
  const capeR = capeRarity(gear)
  d.dx = 1
  d.dy = 5
  if (capeR) {
    d.part = 'cape'
    d.poly([[11, 17], [21, 17], [26, 26], [6, 26]], `cloth.${capeR}`)
  }
  if (gear.helm?.b !== 'capuz') hairBack(d, hairStyle)
  arm(d, 11.5, 19, 9, 24, 'B')
  hand(d, 9, 24, 'B')
  // Folded legs: knees on the ground, feet behind.
  d.dx = 0
  d.dy = 0
  d.part = 'legs'
  d.rect(10, 28, 13, 3, 'pants')
  d.part = 'shoeL'
  d.rect(7, 30, 4, 2, gear.boots ? 'leather' : 'shoe')
  d.dx = 1
  d.dy = 5
  tunic(d)
  if (gear.chest) chest(d, gear.chest)
  amulet(d, gear.amulet)
  if (gear.offhand) offhand(d, gear.offhand, 8, 25)
  arm(d, 20.5, 19, 23, 23, 'F')
  pauldrons(d, gear.chest)
  hand(d, 23, 23, 'F')
  d.dx = 2
  d.dy = 7
  d.part = 'head'
  d.circ(16, 10.5, 7.5, 7.2, 'skin')
  d.part = 'ear'
  d.rect(7, 11, 2, 2, 'skin')
  face(d, look, 'morte')
  if (gear.helm?.b !== 'capacete-de-ferro') hairFront(d, hairStyle)
  if (gear.helm) helm(d, gear.helm)
  d.dx = 0
  d.dy = 0
  for (const [x, y, c, a] of SOUL) d.fxp(x, y, c, a)
  for (const [x, y] of [[5, 8], [28, 10], [26, 5]]) {
    d.fxp(x, y, '#ffd76a')
    d.fxp(x + 1, y, '#ffd76a', 0.5)
    d.fxp(x, y + 1, '#ffd76a', 0.5)
  }
  return render(d, { outline: '#1a0c18' })
}
