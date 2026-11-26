import { describe, expect, it } from 'vitest'
import { STATS_KEYS } from '../../shared/game/items.js'
import { PASSIVES } from '../../shared/game/skill-mods.js'
import {
  MAX_KEYSTONES, RESPEC_GOLD_PER_POINT, SOCKET_NODES, TALENTS, canAllocate, talentStats,
} from '../../shared/game/talents.js'

// Local copy of the recipe names, replaced by the real export in Task 14.
const ICONS = new Set([
  'sword', 'shield', 'staff', 'ring', 'boot', 'helm', 'armor', 'amulet', 'hppot', 'mppot', 'gem', 'coins', 'chest',
  'scroll', 'book', 'keyboard', 'bug', 'flame', 'bolt', 'barrier', 'skull', 'clock', 'xp', 'heart', 'target',
  'feather', 'poison', 'bag', 'hammer', 'map', 'tree', 'snow',
])
const { nodes, edges } = TALENTS
const byId = new Map(nodes.map((n) => [n.id, n]))
const firstSmall = nodes.find((n) => n.branch === 'logica' && n.kind === 'small')
const ctx = { free: 5, branch: { logica: 0, sintaxe: 0, algoritmos: 0 } }

describe('talent tree shape', () => {
  it('has unique ids and a single root', () => {
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length)
    expect(nodes.filter((n) => n.kind === 'root')).toHaveLength(1)
  })

  it('has at least 87 nodes, about 29 per branch', () => {
    expect(nodes.length).toBeGreaterThanOrEqual(87)
    for (const b of ['logica', 'sintaxe', 'algoritmos']) {
      expect(nodes.filter((n) => n.branch === b).length).toBeGreaterThanOrEqual(29)
    }
  })

  it('is connected from the root and every edge points at real nodes', () => {
    const adj = new Map(nodes.map((n) => [n.id, []]))
    for (const [a, b] of edges) {
      expect(byId.has(a) && byId.has(b)).toBe(true)
      adj.get(a).push(b)
      adj.get(b).push(a)
    }
    const seen = new Set(['root'])
    const stack = ['root']
    while (stack.length) for (const n of adj.get(stack.pop())) if (!seen.has(n)) { seen.add(n); stack.push(n) }
    expect(seen.size).toBe(nodes.length)
  })

  it('has 3 to 4 notables per branch, 1 keystone as a leaf, and 2 bridges', () => {
    const degree = new Map(nodes.map((n) => [n.id, 0]))
    for (const [a, b] of edges) { degree.set(a, degree.get(a) + 1); degree.set(b, degree.get(b) + 1) }
    for (const b of ['logica', 'sintaxe', 'algoritmos']) {
      const n = nodes.filter((x) => x.branch === b && x.kind === 'notable' && !PASSIVES[x.effect]).length
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(4)
      const keys = nodes.filter((x) => x.branch === b && x.kind === 'keystone')
      expect(keys).toHaveLength(1)
      expect(degree.get(keys[0].id)).toBe(1)
    }
    expect(nodes.filter((n) => n.kind === 'keystone')).toHaveLength(3)
    expect(nodes.filter((n) => n.branch === 'bridge')).toHaveLength(2)
  })

  it('has the three keystones with their rules', () => {
    expect(byId.get('forca-bruta').effect).toBe('bruteForce')
    expect(byId.get('forca-bruta').stats.attackPct).toBe(60)
    expect(byId.get('tipagem-forte').effect).toBe('strongTyping')
    expect(byId.get('tipagem-forte').stats).toEqual({ hpPct: 40, attackSpeed: -15 })
    expect(byId.get('recursao').effect).toBe('recursion')
    expect(byId.get('recursao').requires).toEqual({ branch: 'algoritmos', correct: 40 })
  })

  it('keeps every node inside the 760x440 box with room for its radius and apart from the others', () => {
    for (const a of nodes) {
      expect(a.x).toBeGreaterThanOrEqual(24)
      expect(a.x).toBeLessThanOrEqual(736)
      expect(a.y).toBeGreaterThanOrEqual(24)
      expect(a.y).toBeLessThanOrEqual(416)
      for (const b of nodes) if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(22)
    }
  })

  it('uses only known stat keys and recipe icons', () => {
    for (const n of nodes) {
      expect(ICONS.has(n.icon)).toBe(true)
      for (const k of Object.keys(n.stats || {})) expect(STATS_KEYS).toContain(k)
    }
  })

  it('exports the constants', () => {
    expect(MAX_KEYSTONES).toBe(1)
    expect(RESPEC_GOLD_PER_POINT).toBe(50)
  })
})

describe('canAllocate', () => {
  it('accepts a node next to the root', () => {
    expect(canAllocate([], firstSmall.id, ctx)).toEqual({ ok: true })
  })

  it('refuses unknown, taken, notAdjacent and noPoints', () => {
    expect(canAllocate([], 'nope', ctx).reason).toBe('unknown')
    expect(canAllocate([firstSmall.id], firstSmall.id, ctx).reason).toBe('taken')
    expect(canAllocate([], 'root', ctx).reason).toBe('taken')
    expect(canAllocate([], 'logica-c3', ctx).reason).toBe('notAdjacent')
    expect(canAllocate([], firstSmall.id, { ...ctx, free: 0 }).reason).toBe('noPoints')
  })

  it('allows only one keystone', () => {
    const path = (b, n) => Array.from({ length: n }, (_, i) => `${b}-c${i}`)
    const allocated = [...path('logica', 7), 'forca-bruta', ...path('sintaxe', 7)]
    expect(canAllocate(allocated, 'tipagem-forte', ctx)).toEqual({ ok: false, reason: 'keystoneLimit' })
    expect(canAllocate(path('logica', 7), 'forca-bruta', ctx)).toEqual({ ok: true })
  })

  it('gates recursao on 40 correct answers in algoritmos', () => {
    const allocated = Array.from({ length: 7 }, (_, i) => `algoritmos-c${i}`)
    const at = (n) => ({ free: 3, branch: { logica: 0, sintaxe: 0, algoritmos: n } })
    expect(canAllocate(allocated, 'recursao', at(39))).toEqual({ ok: false, reason: 'requirement' })
    expect(canAllocate(allocated, 'recursao', at(40))).toEqual({ ok: true })
  })

  it('walks a bridge into a neighbour branch', () => {
    expect(canAllocate(['logica-c0', 'logica-c1', 'logica-c2'], 'ponte-logica-sintaxe', ctx)).toEqual({ ok: true })
  })
})

describe('talentStats', () => {
  it('adds the stats of allocated nodes and ignores the root', () => {
    const stats = talentStats(['root', firstSmall.id])
    expect(stats).toEqual({ ...firstSmall.stats, effects: [] })
  })

  it('sums stats and collects effects', () => {
    const s = talentStats(['forca-bruta', 'logica-c1', 'logica-c1'])
    expect(s.effects).toEqual(['bruteForce'])
    expect(s.attackPct).toBe(61.5)
  })

  it('is empty for nothing', () => {
    expect(talentStats([])).toEqual({ effects: [] })
  })
})

describe('skill passives and sockets (fase 2c)', () => {
  const degree = new Map(nodes.map((n) => [n.id, 0]))
  for (const [a, b] of edges) { degree.set(a, degree.get(a) + 1); degree.set(b, degree.get(b) + 1) }
  const passives = nodes.filter((n) => PASSIVES[n.effect])

  it('places every skill passive once, as a notable at the end of a side path, 3 or 4 per branch', () => {
    expect(passives.map((n) => n.effect).sort()).toEqual(Object.keys(PASSIVES).sort())
    for (const n of passives) {
      expect(n.kind).toBe('notable')
      expect(degree.get(n.id), n.id).toBe(1)
      expect(n.icon).toBe(PASSIVES[n.effect].icon)
      expect(n.stats).toEqual({})
    }
    for (const b of ['logica', 'sintaxe', 'algoritmos']) {
      const count = passives.filter((n) => n.branch === b).length
      expect(count, b).toBeGreaterThanOrEqual(3)
      expect(count, b).toBeLessThanOrEqual(4)
    }
  })

  it('has 4 socket nodes, leaves with no stats, at least one per branch', () => {
    const sockets = nodes.filter((n) => n.kind === 'socket')
    expect(sockets.map((n) => n.id)).toEqual(SOCKET_NODES)
    expect(sockets).toHaveLength(4)
    for (const n of sockets) {
      expect(degree.get(n.id), n.id).toBe(1)
      expect(n.icon).toBe('gem')
      expect(n.stats).toEqual({})
    }
    for (const b of ['logica', 'sintaxe', 'algoritmos']) expect(sockets.some((n) => n.branch === b), b).toBe(true)
  })

  it('collects a passive as an effect and gives nothing for a socket', () => {
    const path = ['logica-c0', 'logica-c1', 'logica-f1-1', 'logica-f1-2']
    expect(talentStats(path).effects).toEqual(['golpeTwice'])
    expect(talentStats(['logica-c0', 'logica-c1', 'logica-f0-1'])).toEqual(talentStats(['logica-c0', 'logica-c1']))
  })

  it('allocates a socket like any node', () => {
    expect(canAllocate(['logica-c0', 'logica-c1'], 'logica-f0-1', ctx)).toEqual({ ok: true })
  })
})
