// Talent tree for Glitch World: one root, three branches (logica, sintaxe, algoritmos), two bridges and one
// keystone per branch. Pure data and rules: the server validates allocations with canAllocate and the client
// draws the tree from the x/y layout (a 760x440 box). Ids and stat keys only, labels live in i18n.
// Fase 2c: some side paths end in a skill passive (a notable whose effect changes a skill, skill-mods.js)
// or a socket (kind 'socket', holds one support gem: the hero's treeSockets).
import { STATS_KEYS } from './items.js'
import { PASSIVES } from './skill-mods.js'

export const MAX_KEYSTONES = 1
export const RESPEC_GOLD_PER_POINT = 50

export const TREE_WIDTH = 760
export const TREE_HEIGHT = 440
const ROOT = { x: 380, y: 408 }
const BRANCH_ANGLES = { logica: -150, sintaxe: -90, algoritmos: -30 }
const CHAIN_DIST = [50, 93, 136, 179, 222, 265, 308, 351]
const CHAIN_KINDS = ['small', 'small', 'notable', 'small', 'small', 'notable', 'small', 'keystone']
const FORK_STEP = 34
const FORK_ALONG = 12

// The icon of a node follows its first stat. All names are recipe names.
const STAT_ICON = {
  attack: 'sword', attackPct: 'hammer', critChance: 'target', critDamage: 'flame', attackSpeed: 'feather',
  magicPct: 'staff', mana: 'mppot', hp: 'hppot', hpPct: 'heart', armor: 'armor', dodge: 'boot',
  resFire: 'flame', resIce: 'barrier', resLightning: 'bolt', resPoison: 'poison',
}

// Per branch: the small stats (cycled), the notable stats (chain first, then fork ends), the keystone and
// the forks as [chain index, side, length, notable at the end].
const BRANCHES = {
  logica: {
    smalls: [{ attack: 2 }, { attackPct: 1.5 }, { critDamage: 3 }, { attackSpeed: 1.5 }],
    notables: [
      { attackPct: 6, critDamage: 8 },
      { attack: 8, attackSpeed: 4 },
      { critChance: 3, attackPct: 4 },
      { attackPct: 8, hp: 20 },
    ],
    keystone: { id: 'forca-bruta', icon: 'hammer', stats: { attackPct: 60 }, effect: 'bruteForce' },
    forks: [[1, 1, 1, false], [1, -1, 2, false], [3, 1, 4, true], [3, -1, 4, false], [4, -1, 4, true], [5, -1, 3, false], [6, -1, 3, false]],
  },
  sintaxe: {
    smalls: [{ hp: 8 }, { hpPct: 1.5 }, { armor: 3 }, { resFire: 2 }, { resIce: 2 }, { resPoison: 2 }],
    notables: [
      { hpPct: 6, armor: 8 },
      { hp: 40, resLightning: 6 },
      { armor: 12, dodge: 3 },
      { hpPct: 8, resFire: 6 },
    ],
    keystone: { id: 'tipagem-forte', icon: 'shield', stats: { hpPct: 40, attackSpeed: -15 }, effect: 'strongTyping' },
    forks: [[2, 1, 3, false], [2, -1, 3, false], [3, 1, 3, true], [3, -1, 3, true], [4, 1, 3, false], [5, -1, 3, false], [6, 1, 3, false]],
  },
  algoritmos: {
    smalls: [{ magicPct: 2 }, { mana: 6 }, { critChance: 0.8 }, { resLightning: 2 }],
    notables: [
      { magicPct: 8, mana: 15 },
      { critChance: 3, critDamage: 8 },
      { magicPct: 6, critChance: 2 },
      { mana: 30, magicPct: 5 },
    ],
    keystone: {
      id: 'recursao', icon: 'book', stats: {}, effect: 'recursion', requires: { branch: 'algoritmos', correct: 40 },
    },
    forks: [[1, -1, 1, false], [1, 1, 2, false], [3, 1, 4, true], [3, -1, 4, false], [4, 1, 4, true], [5, 1, 3, false], [6, 1, 3, false]],
  },
}

// Where each skill passive sits: one cheap per branch (golpe, raio and cura come early), the rest deep.
const PASSIVE_AT = {
  'logica-f1-2': 'golpeTwice',
  'logica-f3-4': 'critBlast',
  'logica-f5-3': 'quickCache',
  'logica-f6-3': 'globalScope',
  'sintaxe-f1-3': 'garbageCollector',
  'sintaxe-f4-3': 'tryCatch',
  'sintaxe-f5-3': 'endlessWinter',
  'algoritmos-f1-2': 'breadthFirst',
  'algoritmos-f3-4': 'divideConquer',
  'algoritmos-f5-3': 'fork',
  'algoritmos-f6-3': 'memoryLeak',
}
// The socket nodes: one near the root of each branch, and one deep in sintaxe.
export const SOCKET_NODES = ['logica-f0-1', 'sintaxe-f0-3', 'sintaxe-f6-3', 'algoritmos-f0-1']

const round = (n) => Math.round(n * 10) / 10
const iconFor = (stats) => STAT_ICON[Object.keys(stats)[0]] || 'gem'

function build() {
  const nodes = [{ id: 'root', branch: 'root', kind: 'root', icon: 'tree', x: ROOT.x, y: ROOT.y }]
  const edges = []
  const chains = {}
  const push = (node, from) => {
    nodes.push({ ...node, x: round(node.x), y: round(node.y) })
    edges.push([from, node.id])
  }
  for (const [branch, cfg] of Object.entries(BRANCHES)) {
    const a = (BRANCH_ANGLES[branch] * Math.PI) / 180
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const px = -dy
    const py = dx
    let smallIdx = 0
    let notableIdx = 0
    let prev = 'root'
    chains[branch] = []
    CHAIN_DIST.forEach((d, i) => {
      const kind = CHAIN_KINDS[i]
      const x = ROOT.x + dx * d
      const y = ROOT.y + dy * d
      let node
      if (kind === 'keystone') {
        const k = cfg.keystone
        node = {
          id: k.id, branch, kind, icon: k.icon, x, y, stats: k.stats, effect: k.effect,
          ...(k.requires ? { requires: k.requires } : {}),
        }
      } else {
        const stats = kind === 'notable' ? cfg.notables[notableIdx++] : cfg.smalls[smallIdx++ % cfg.smalls.length]
        node = { id: `${branch}-c${i}`, branch, kind, icon: iconFor(stats), x, y, stats }
      }
      push(node, prev)
      chains[branch].push(node.id)
      prev = node.id
    })
    cfg.forks.forEach(([at, side, len, endNotable], f) => {
      const base = nodes.find((n) => n.id === chains[branch][at])
      let from = base.id
      for (let k = 1; k <= len; k++) {
        const notable = k === len && endNotable
        const stats = notable ? cfg.notables[notableIdx++ % cfg.notables.length] : cfg.smalls[smallIdx++ % cfg.smalls.length]
        const node = {
          id: `${branch}-f${f}-${k}`,
          branch,
          kind: notable ? 'notable' : 'small',
          icon: iconFor(stats),
          x: base.x + px * side * FORK_STEP * k + dx * FORK_ALONG * k,
          y: base.y + py * side * FORK_STEP * k + dy * FORK_ALONG * k,
          stats,
        }
        push(node, from)
        from = node.id
      }
    })
  }
  // Bridges sit on the ring of the first notables, between neighbouring branches.
  const bridge = (id, angle, left, right, stats) => {
    const r = (angle * Math.PI) / 180
    const node = {
      id, branch: 'bridge', kind: 'small', icon: iconFor(stats), stats,
      x: ROOT.x + Math.cos(r) * CHAIN_DIST[2],
      y: ROOT.y + Math.sin(r) * CHAIN_DIST[2],
    }
    push(node, chains[left][2])
    edges.push([id, chains[right][2]])
  }
  bridge('ponte-logica-sintaxe', -120, 'logica', 'sintaxe', { attackPct: 2, hpPct: 2 })
  bridge('ponte-sintaxe-algoritmos', -60, 'sintaxe', 'algoritmos', { hpPct: 2, magicPct: 2 })
  // The ends of side paths that change a skill or hold a support gem, in place of a small stat.
  for (const node of nodes) {
    const effect = PASSIVE_AT[node.id]
    if (effect) Object.assign(node, { kind: 'notable', icon: PASSIVES[effect].icon, stats: {}, effect })
    if (SOCKET_NODES.includes(node.id)) Object.assign(node, { kind: 'socket', icon: 'gem', stats: {} })
  }
  return { nodes, edges }
}

export const TALENTS = build()
export const TALENT_ICONS = [...new Set(TALENTS.nodes.map((n) => n.icon))]

const BY_ID = new Map(TALENTS.nodes.map((n) => [n.id, n]))
const NEIGHBOURS = new Map()
for (const [a, b] of TALENTS.edges) {
  if (!NEIGHBOURS.has(a)) NEIGHBOURS.set(a, [])
  if (!NEIGHBOURS.has(b)) NEIGHBOURS.set(b, [])
  NEIGHBOURS.get(a).push(b)
  NEIGHBOURS.get(b).push(a)
}

// The root is always allocated and free. A node needs an allocated neighbour, a free point and its rules.
export function canAllocate(allocated, id, { free = 0, branch = {} } = {}) {
  const node = BY_ID.get(id)
  if (!node) return { ok: false, reason: 'unknown' }
  const have = new Set(['root', ...allocated])
  if (have.has(id)) return { ok: false, reason: 'taken' }
  if (node.kind === 'keystone') {
    const keystones = [...have].filter((n) => BY_ID.get(n)?.kind === 'keystone').length
    if (keystones >= MAX_KEYSTONES) return { ok: false, reason: 'keystoneLimit' }
  }
  if (node.requires && (branch[node.requires.branch] || 0) < node.requires.correct) {
    return { ok: false, reason: 'requirement' }
  }
  if (!(NEIGHBOURS.get(id) || []).some((n) => have.has(n))) return { ok: false, reason: 'notAdjacent' }
  if (free <= 0) return { ok: false, reason: 'noPoints' }
  return { ok: true }
}

// The support gem ids the hero fights with: those in socket nodes it has taken, each kind once.
// treeSockets: { [socket node id]: { id, kind: 'support', support } }.
export function socketedSupports(allocated, treeSockets = {}) {
  const have = new Set(allocated)
  const ids = Object.entries(treeSockets ?? {})
    .filter(([node, gem]) => have.has(node) && BY_ID.get(node)?.kind === 'socket' && typeof gem?.support === 'string')
    .map(([, gem]) => gem.support)
  return [...new Set(ids)]
}

export function talentStats(allocated) {
  const total = {}
  const effects = []
  for (const id of new Set(allocated)) {
    const node = BY_ID.get(id)
    if (!node || node.kind === 'root') continue
    for (const [key, value] of Object.entries(node.stats || {})) {
      if (STATS_KEYS.includes(key)) total[key] = round((total[key] || 0) + value)
    }
    if (node.effect) effects.push(node.effect)
  }
  return { ...total, effects: [...new Set(effects)] }
}
