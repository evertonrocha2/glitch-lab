import { claimSpawns } from './pack.js'
import { orient, unrotate } from './placement.js'

// A pack fight starting where ambient monsters stand (ambient.js): the scene takes the monsters nearest
// the hero and each foe walks in from its monster's spot instead of out of nowhere. Presentation only:
// the log, the outcome and replays are untouched. Pure, no DOM.
//   ambient: an ambient set or null. pack: buildPack's. tile: the hero's tile, where the pack is
//   anchored. spread: how much wider the scene draws the log's offsets.
// Answers { pack, rot, claims }: the pack to draw (claimed foes start at their monster), the turn the
// scene draws it with, and per foe the claimed monster ({ id, x, y, enemy, sprite }) or null.
// Bosses and the adds they call are never claimed: they keep their entrance.
export function claimFight({ ambient, pack, world, rect, tile, spread }) {
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
  const froms = claims.map((c) => (c ? unrotate(rot, { x: (c.x - tile.x) / spread, y: (c.y - tile.y) / spread }, { x: 0, y: 0 }) : null))
  return { pack: claimSpawns(pack, froms), rot, claims }
}
