import { PASSIVES, SUPPORTS } from '../../../../shared/game/skill-mods.js'
import { MAT, SUPPORT_MATS } from '../icons/recipes.js'

// How support gems look (their pixel icon, a recipe named support-<id>, and their color) and the words
// for the tree's skill passives and support gems, with the numbers from shared/game/skill-mods.js.

// The material each support gem is cut from (icons/recipes.js MAT).
export const SUPPORT_MAT = SUPPORT_MATS

const known = (id) => typeof id === 'string' && Object.hasOwn(SUPPORT_MAT, id)
export const supportIcon = (id) => (known(id) ? `support-${id}` : 'gem')
export const supportColor = (id) => (known(id) ? MAT[SUPPORT_MAT[id]][2] : '#4fd1c5')

const pct = (share) => Math.round(Math.abs(share) * 100)
const seconds = (ms) => ms / 1000

// The {vars} of each text.
const PASSIVE_VARS = {
  golpeTwice: (p) => ({ pct: pct(p.echo) }),
  breadthFirst: (p) => ({ n: p.targets }),
  parallelFire: () => ({}),
  fork: () => ({}),
  endlessWinter: (p) => ({ pct: pct(p.area) }),
  globalScope: (p) => ({ pct: pct(p.area) }),
  quickCache: (p) => ({ pct: pct(p.cooldown) }),
  memoryLeak: (p) => ({ pct: pct(p.duration) }),
  critBlast: (p) => ({ pct: pct(p.blast.pct), radius: p.blast.radius }),
  rethrow: (p) => ({ pct: pct(p.reflect) }),
  garbageCollector: (p) => ({ pct: pct(p.hot.pct), seconds: seconds(p.hot.ms) }),
}
const SUPPORT_VARS = {
  projeteis: (s) => ({ n: s.extra, pct: pct(s.more) }),
  encadear: (s) => ({ n: s.targets }),
  areaAmpla: (s) => ({ pct: pct(s.area) }),
  concentrado: (s) => ({ area: pct(s.area), pct: pct(s.more) }),
  rapido: (s) => ({ pct: pct(s.cooldown), mana: pct(s.mana) }),
  fogo: (s) => ({ pct: pct(s.addedFire) }),
  vampiro: (s) => ({ pct: pct(s.leech) }),
  frio: (s) => ({ pct: pct(s.slow.pct), seconds: seconds(s.slow.ms) }),
  persistencia: (s) => ({ pct: pct(s.duration) }),
}

// Names and one-line effects. kind: 'passive' | 'support'. num formats numbers in the reader's locale.
export function modText(t, num = (n) => String(n)) {
  const vars = (kind, id) => {
    const raw = kind === 'passive' ? PASSIVE_VARS[id]?.(PASSIVES[id]) : SUPPORT_VARS[id]?.(SUPPORTS[id])
    return Object.fromEntries(Object.entries(raw ?? {}).map(([key, value]) => [key, num(value)]))
  }
  const name = (kind, id) => t(`game.${kind}.${id}`)
  const desc = (kind, id) => t(`game.${kind}Desc.${id}`, vars(kind, id))
  return { name, desc }
}
