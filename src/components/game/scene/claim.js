import { claimSpawns } from './pack.js'
import { canStand, orient, rotate, unrotate } from './placement.js'

// A member with no monster to claim walks in from just past the edge of the view instead of a portal,
// when that walk is at most this many times as long as the logged one (it has the logged time to do
// it, so a longer walk would be a dash). Otherwise it keeps its portal.
export const WALK_IN_STRETCH = 1.5
// How far along an edge (tiles, each way) a walk-in start is looked for around `to`'s projection.
const EDGE_REACH = 4

// Whether p (tiles) is off the view, sprite overhang included.
const offView = (v, p) => p.x < v.x - 1 || p.x >= v.x + v.w + 1 || p.y < v.y - 1 || p.y >= v.y + v.h + 1

// The floor tile of the hunted zone just past an edge of the view nearest `to` (map tiles), or null.
function edgeStart(world, rect, view, to) {
  const lines = [
    { y: Math.ceil(view.y - 1) - 1 },
    { y: Math.ceil(view.y + view.h + 1) },
    { x: Math.ceil(view.x - 1) - 1 },
    { x: Math.ceil(view.x + view.w + 1) },
  ]
  let best = null
  let bestD = Infinity
  for (const line of lines) {
    const along = line.y !== undefined ? Math.round(to.x) : Math.round(to.y)
    for (let k = -EDGE_REACH; k <= EDGE_REACH; k++) {
      const x = line.x ?? along + k
      const y = line.y ?? along + k
      if (!canStand(world, rect, x, y)) continue
      const d = Math.hypot(x - to.x, y - to.y)
      if (d < bestD) {
        best = { x, y }
        bestD = d
      }
    }
  }
  return best
}

// A pack fight starting where ambient monsters stand (ambient.js): the scene takes the monsters nearest
// the hero and each foe walks in from its monster's spot instead of out of nowhere. Presentation only:
// the log, the outcome and replays are untouched. Pure, no DOM.
//   ambient: an ambient set or null. pack: buildPack's. tile: the hero's tile, where the pack is
//   anchored. spread: how much wider the scene draws the log's offsets.
// view: the camera's window in tiles, or null. A member left with no monster whose logged spawn is on
// screen walks in from just past the view's edge (WALK_IN_STRETCH), else it keeps its portal.
// Answers { pack, rot, claims, edges }: the pack to draw (claimed foes start at their monster), the
// turn the scene draws it with, per foe the claimed monster ({ id, x, y, enemy, sprite }) or null, and
// per foe whether it walks in from the edge. Bosses and the adds they call keep their entrance.
export function claimFight({ ambient, pack, world, rect, tile, spread, view = null }) {
  const wide = (p) => ({ x: p.x * spread, y: p.y * spread })
  const claims = pack.foes.map(() => null)
  if (ambient) {
    const members = []
    pack.foes.forEach((f, i) => {
      if (!f.boss && !f.add) members.push(i)
    })
    const got = ambient.claimPack(
      members.map((i) => ({ enemy: pack.foes[i].id ?? pack.foes[i].sprite, sprite: pack.foes[i].sprite })),
      tile,
    )
    members.forEach((i, k) => {
      claims[i] = got[k]
    })
  }
  const spots = pack.foes.map((f, i) => {
    const c = claims[i]
    return c ? { to: wide(f.to), near: { x: c.x - tile.x, y: c.y - tile.y } } : { from: wide(f.from), to: wide(f.to) }
  })
  const rot = orient(world, rect, tile, spots)
  // Map tiles <-> the log's hero relative offsets, as the scene draws them.
  const toMap = (p) => {
    const r = rotate(rot, p, { x: 0, y: 0 })
    return { x: tile.x + r.x * spread, y: tile.y + r.y * spread }
  }
  const toLog = (p) => unrotate(rot, { x: (p.x - tile.x) / spread, y: (p.y - tile.y) / spread }, { x: 0, y: 0 })
  const edges = pack.foes.map(() => false)
  const froms = pack.foes.map((f, i) => {
    const c = claims[i]
    if (c) return toLog(c)
    if (!view || f.boss || f.add) return null
    const from = toMap(f.from)
    if (offView(view, from)) return null
    const to = toMap(f.to)
    const logged = Math.hypot(from.x - to.x, from.y - to.y)
    const start = logged > 0 ? edgeStart(world, rect, view, to) : null
    if (!start || Math.hypot(start.x - to.x, start.y - to.y) > logged * WALK_IN_STRETCH) return null
    edges[i] = true
    return toLog(start)
  })
  return { pack: claimSpawns(pack, froms), rot, claims, edges }
}
