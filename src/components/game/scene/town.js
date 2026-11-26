import { heroSprite } from '../hero/hero-cache.js'
import { SPRITE } from '../hero/draw-hero.js'
import { ellipse, P, rect, SHADOW } from './pixels.js'
import { TS } from './tiles.js'

// The town's people and signs, drawn by the game scene (fase 3). NPCs are hero dolls with their own
// look and gear (the same painter as the hero), the quest board is a notice board on two posts, and
// each road gets a small sign with the region it leads to. Everything paints with fillRect and
// drawImage, at one canvas pixel per art pixel.

// The look and worn pieces of each keeper (shared/world/worlds.js NPC_IDS).
export const NPC_LOOKS = {
  merchant: { look: { skin: 1, hairStyle: 2, hairColor: 3, eyeStyle: 1, eyeColor: 0, outfit: 2 }, gear: { helm: { b: 'capuz', r: 'rare' }, ring: { b: 'anel', r: 'epic' } } },
  alchemist: { look: { skin: 3, hairStyle: 4, hairColor: 6, eyeStyle: 2, eyeColor: 2, outfit: 5 }, gear: { weapon: { b: 'cajado', r: 'epic' }, amulet: { b: 'amuleto', r: 'rare' } } },
  smith: { look: { skin: 2, hairStyle: 1, hairColor: 1, eyeStyle: 0, eyeColor: 1, outfit: 6 }, gear: { weapon: { b: 'martelo', r: 'common' }, chest: { b: 'armadura', r: 'uncommon' } } },
  jeweler: { look: { skin: 0, hairStyle: 5, hairColor: 5, eyeStyle: 3, eyeColor: 3, outfit: 3 }, gear: { amulet: { b: 'colar-de-logs', r: 'legendary' }, ring: { b: 'anel-de-bits', r: 'epic' } } },
}

// Ardósia: steel blue and gold on graphite slate.
const TAG = { ink: '#141821', edge: '#5b7fa6', text: '#e8edf5', gold: '#e8c35a' }
const WOOD = ['#3b2414', '#5e3a1e', '#8a5a34', '#b07c4a']
const PAPER = ['#d9d3c0', '#efe9d6', '#b9b29c']

// A keeper standing on tile (tx, ty), facing `side` (1 right, -1 left), breathing on its own beat.
export function drawNpc(ctx, npc, { t = 0, reduced = false, side = 1 } = {}) {
  const x = npc.x * TS
  const y = npc.y * TS
  if (npc.id === 'quests') {
    questBoard(ctx, x, y)
    return
  }
  const dress = NPC_LOOKS[npc.id]
  if (!dress) return
  const beat = reduced ? 0 : Math.floor(t * 2 + npc.x * 0.37) % 2
  const img = heroSprite(dress.look, dress.gear, beat ? 'idle1' : 'idle0')
  ellipse(ctx, x + 8, y + 15, 8, 2, SHADOW)
  const dx = x + 8 - (SPRITE.ox + 16)
  const dy = y + 16 - (SPRITE.oy + 32)
  if (side === -1) {
    ctx.save()
    ctx.translate(x + 8, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(img, dx - (x + 8), dy)
    ctx.restore()
  } else ctx.drawImage(img, dx, dy)
}

// A notice board on two posts, pinned with papers and a gold seal: the quest board.
function questBoard(ctx, x, y) {
  ellipse(ctx, x + 8, y + 15, 8, 2, SHADOW)
  rect(ctx, x + 2, y + 6, 2, 10, WOOD[1])
  rect(ctx, x + 12, y + 6, 2, 10, WOOD[1])
  rect(ctx, x + 2, y + 6, 1, 10, WOOD[2])
  rect(ctx, x + 12, y + 6, 1, 10, WOOD[2])
  rect(ctx, x - 1, y - 4, 18, 12, WOOD[0])
  rect(ctx, x, y - 3, 16, 10, WOOD[2])
  rect(ctx, x, y - 3, 16, 1, WOOD[3])
  rect(ctx, x + 1, y - 1, 5, 6, PAPER[1])
  rect(ctx, x + 1, y + 4, 5, 1, PAPER[2])
  rect(ctx, x + 7, y - 2, 4, 5, PAPER[0])
  rect(ctx, x + 12, y, 3, 5, PAPER[1])
  for (const [px, py] of [[2, 1], [2, 3], [8, 0], [13, 2]]) rect(ctx, x + px, y + py, 3, 1, '#7a7466')
  P(ctx, x + 3, y - 1, '#c0392b')
  P(ctx, x + 9, y - 2, '#2f7ae0')
  P(ctx, x + 13, y, TAG.gold)
  rect(ctx, x + 6, y - 6, 4, 2, TAG.gold)
  P(ctx, x + 7, y - 7, TAG.gold)
}

// A small label over an NPC or a road: dark slate plate, steel edge, light text. (x, y): the plate's
// bottom middle, in canvas px. tone 'gold' for the shops.
export function nameTag(ctx, text, x, y, { tone = 'steel' } = {}) {
  if (!text) return
  ctx.font = 'bold 7px monospace'
  const w = Math.ceil((ctx.measureText?.(text)?.width ?? text.length * 4.2) + 6)
  const left = Math.round(x - w / 2)
  const top = Math.round(y - 10)
  ctx.globalAlpha = 0.88
  rect(ctx, left, top, w, 10, TAG.ink)
  ctx.globalAlpha = 1
  rect(ctx, left, top + 9, w, 1, tone === 'gold' ? TAG.gold : TAG.edge)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = tone === 'gold' ? TAG.gold : TAG.text
  ctx.fillText(text, Math.round(x), top + 7)
}

// Where a road's sign sits, in canvas px: two tiles in from the edge, at the middle of the road.
// arrow: the way out ('<', '>', '^', 'v').
export function roadSign(world, road) {
  const cols = world.rows[0].length
  const rows = world.rows.length
  const mid = (road.start + 1) * TS + 8
  if (road.side === 'west') return { x: 2 * TS + 8, y: mid - 10, arrow: '<' }
  if (road.side === 'east') return { x: (cols - 2) * TS - 8, y: mid - 10, arrow: '>' }
  if (road.side === 'north') return { x: mid, y: 2 * TS + 14, arrow: '^' }
  return { x: mid, y: (rows - 2) * TS - 2, arrow: 'v' }
}

// The lights the town's people bring: a warm lantern over each keeper.
export function npcLights(world) {
  return (world.npcs ?? []).map((npc) => ({ x: npc.x * TS + 8, y: npc.y * TS - 6, r: 26, rgb: '255,205,120', a: 0.32 }))
}
