import { useEffect, useRef, useState } from 'react'
import { PASSIVES } from '../../../../shared/game/skill-mods.js'
import { TALENTS, TREE_HEIGHT, TREE_WIDTH } from '../../../../shared/game/talents.js'
import { iconCanvas } from '../icons/sprite.js'
import { useReducedMotion } from '../use-reduced-motion.js'
import { supportColor, supportIcon } from './support-gem.js'

// The talent tree drawn like the approved mockup (game-depth.html, #tree): owned path in gold, nodes
// you can take now glowing (a still white outline with reduced motion), queued nodes in cyan,
// keystones octagonal with a 2x icon. Fase 2c: skill passives wear a second, cyan ring; sockets are
// hexagonal gem slots, sunk and empty or filled with their support gem's color and icon. The canvas is
// decoration plus a mouse target: the tab's hidden node list is the accessible version, so the canvas
// is aria-hidden.

export const BRANCH_COLORS = { logica: '#ff5a6e', sintaxe: '#5fd38a', algoritmos: '#a98bff', bridge: '#f2c14e', root: '#f2c14e' }
const RADIUS = { root: 20, small: 8, notable: 15, keystone: 22, socket: 13 }
const QUEUED = '#7fffe9'
const PASSIVE_RING = '#7fe9ff'
const NODE_BY_ID = new Map(TALENTS.nodes.map((node) => [node.id, node]))
const ROOT = NODE_BY_ID.get('root')
const KEYSTONES = TALENTS.nodes.filter((node) => node.kind === 'keystone')

// The node under a point in tree units, or null. Small nodes get a generous target: on a narrow
// panel they are only a few pixels wide.
export function nodeAt(x, y) {
  let best = null
  let bestDist = Infinity
  for (const node of TALENTS.nodes) {
    const dist = Math.hypot(node.x - x, node.y - y)
    if (dist <= Math.max(RADIUS[node.kind] + 4, 18) && dist < bestDist) {
      best = node
      bestDist = dist
    }
  }
  return best
}

// A regular polygon around the node: sides, turned by `turn` radians.
function polygon(ctx, node, r, sides, turn) {
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + turn
    ctx[i ? 'lineTo' : 'moveTo'](node.x + Math.cos(a) * r, node.y + Math.sin(a) * r)
  }
  ctx.closePath()
}

function shape(ctx, node, r) {
  ctx.beginPath()
  if (node.kind === 'keystone') polygon(ctx, node, r, 8, Math.PI / 8)
  else if (node.kind === 'socket') polygon(ctx, node, r, 6, Math.PI / 6)
  else ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
}

// A socket: a sunk slot, filled with its gem (color and icon) or showing a faint gem outline.
function drawSocket(ctx, node, support, lit) {
  const r = RADIUS.socket
  ctx.beginPath()
  polygon(ctx, node, r - 4, 6, Math.PI / 6)
  ctx.fillStyle = support ? supportColor(support) : '#0a0818'
  ctx.fill()
  const sprite = iconCanvas(support ? supportIcon(support) : 'gem')
  if (sprite) {
    ctx.globalAlpha = support ? 1 : lit ? 0.35 : 0.2
    ctx.drawImage(sprite, node.x - 9, node.y - 9, 18, 18)
    ctx.globalAlpha = 1
  }
}

// One frame. state: { owned, queued, open (Sets of ids), selected, labels, sockets ({ node id: support
// id }) }. t: seconds, or null when still (reduced motion). labelScale: how much bigger to draw the
// branch labels (1 at full size).
export function drawTree(ctx, { owned, queued, open, selected, labels, sockets = {} }, t, labelScale = 1) {
  const pulse = t === null ? 0 : Math.sin(t * 4)
  const bg = ctx.createRadialGradient(380, 300, 20, 380, 260, 460)
  bg.addColorStop(0, '#1d1640')
  bg.addColorStop(1, '#0a0818')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, TREE_WIDTH, TREE_HEIGHT)
  for (let i = 0; i < 70; i++) {
    const alpha = t === null ? 0.22 : 0.15 + 0.15 * Math.sin(t * 1.3 + i)
    ctx.fillStyle = `rgba(200,190,255,${alpha})`
    ctx.fillRect((i * 197) % TREE_WIDTH, (i * 131) % TREE_HEIGHT, 2, 2)
  }

  const has = (id) => owned.has(id) || queued.has(id)
  for (const [a, b] of TALENTS.edges) {
    const A = NODE_BY_ID.get(a)
    const B = NODE_BY_ID.get(b)
    const gold = owned.has(a) && owned.has(b)
    const cyan = !gold && has(a) && has(b)
    ctx.strokeStyle = gold ? '#f2c14e' : cyan ? QUEUED : '#3a3358'
    ctx.lineWidth = gold || cyan ? 5 : 3
    ctx.beginPath()
    if (A.branch === 'bridge' || B.branch === 'bridge') {
      // Bridges ride the ring of the first notables, around the root.
      const r = Math.hypot(A.x - ROOT.x, A.y - ROOT.y)
      const a1 = Math.atan2(A.y - ROOT.y, A.x - ROOT.x)
      const a2 = Math.atan2(B.y - ROOT.y, B.x - ROOT.x)
      ctx.arc(ROOT.x, ROOT.y, r, Math.min(a1, a2), Math.max(a1, a2))
    } else {
      ctx.moveTo(A.x, A.y)
      ctx.lineTo(B.x, B.y)
    }
    ctx.stroke()
  }

  for (const node of TALENTS.nodes) {
    const r = RADIUS[node.kind]
    const col = BRANCH_COLORS[node.branch]
    const mine = owned.has(node.id)
    const inQueue = queued.has(node.id)
    const can = open.has(node.id)
    if (mine || inQueue || can) {
      ctx.save()
      ctx.shadowColor = mine ? col : inQueue ? QUEUED : '#ffffff'
      ctx.shadowBlur = mine ? 12 : 8 + 6 * pulse
      shape(ctx, node, r)
      ctx.fillStyle = '#000'
      ctx.fill()
      ctx.restore()
    }
    shape(ctx, node, r)
    ctx.fillStyle = mine || inQueue ? (node.kind === 'small' ? (mine ? col : QUEUED) : '#2a1f5a') : '#17122e'
    ctx.fill()
    ctx.lineWidth = node.kind === 'small' ? 2 : 3
    ctx.strokeStyle = mine ? '#f2c14e' : inQueue ? QUEUED : can ? `rgba(255,255,255,${0.6 + 0.4 * pulse})` : '#4a4266'
    ctx.stroke()
    if (PASSIVES[node.effect]) {
      ctx.save()
      ctx.globalAlpha = mine || inQueue ? 0.95 : 0.55
      ctx.lineWidth = 1.5
      ctx.strokeStyle = PASSIVE_RING
      ctx.beginPath()
      ctx.arc(node.x, node.y, r + 4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    if (node.kind === 'socket') drawSocket(ctx, node, Object.hasOwn(sockets, node.id) ? sockets[node.id] : null, mine || can)
    else if (node.kind !== 'small') {
      const sprite = iconCanvas(node.icon)
      const size = node.kind === 'keystone' || node.kind === 'root' ? 36 : 18
      if (sprite) {
        ctx.globalAlpha = mine || inQueue ? 1 : can ? 0.85 : 0.4
        ctx.drawImage(sprite, node.x - size / 2, node.y - size / 2, size, size)
        ctx.globalAlpha = 1
      }
    }
    if (node.id === selected) {
      ctx.save()
      ctx.setLineDash?.([4, 3])
      ctx.lineWidth = 2
      ctx.strokeStyle = '#ffd76a'
      shape(ctx, node, r + 6)
      ctx.stroke()
      ctx.restore()
    }
  }

  // Branch labels by their keystone. Shown smaller than 760px wide, the canvas draws them bigger so they
  // stay readable. A keystone with no room above it (the top one) gets its label on its left.
  const nameSize = Math.round(14 * labelScale)
  const subSize = Math.round(10 * labelScale)
  const text = (line, size, bold, color, x, y, align) => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ui-monospace, Menlo, monospace`
    ctx.fillStyle = color
    ctx.textAlign = align
    const width = ctx.measureText?.(line)?.width ?? 0
    const at = align === 'center' ? Math.min(TREE_WIDTH - width / 2 - 4, Math.max(width / 2 + 4, x)) : x
    ctx.fillText(line, at, y)
  }
  for (const key of KEYSTONES) {
    const label = labels?.[key.branch]
    if (!label) continue
    const r = RADIUS.keystone
    if (key.y - r < nameSize + subSize + 12) {
      const x = key.x - r - 10
      text(label.name, nameSize, true, BRANCH_COLORS[key.branch], x, key.y, 'right')
      text(label.sub, subSize, false, '#9a93b8', x, key.y + subSize + 3, 'right')
    } else {
      const subY = key.y - r - 8
      text(label.sub, subSize, false, '#9a93b8', key.x, subY, 'center')
      text(label.name, nameSize, true, BRANCH_COLORS[key.branch], key.x, subY - subSize - 3, 'center')
    }
  }
}

// Props: owned, queued, open (Sets of node ids), selected (id or null), labels ({ [branch]: { name, sub } }),
// sockets ({ [node id]: support id }), onSelect(id).
export default function TalentCanvas({ owned, queued, open, selected, labels, sockets, onSelect }) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(TREE_WIDTH)
  const labelScale = Math.min(2, Math.max(1, TREE_WIDTH / shown))

  // The width the canvas is shown at, for the label size.
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => setShown(canvas.clientWidth || TREE_WIDTH))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return undefined
    ctx.imageSmoothingEnabled = false
    const state = { owned, queued, open, selected, labels, sockets }
    if (reduced) {
      drawTree(ctx, state, null, labelScale)
      return undefined
    }
    let frame = 0
    const loop = (ms) => {
      drawTree(ctx, state, ms / 1000, labelScale)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [owned, queued, open, selected, labels, sockets, reduced, labelScale])

  function onClick(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = ((event.clientX - rect.left) / rect.width) * TREE_WIDTH
    const y = ((event.clientY - rect.top) / rect.height) * TREE_HEIGHT
    const node = nodeAt(x, y)
    if (node) onSelect(node.id)
  }

  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: the canvas takes no focus (no tabindex); the hidden node list is the keyboard path.
    <canvas
      ref={ref}
      data-tree=""
      width={TREE_WIDTH}
      height={TREE_HEIGHT}
      aria-hidden="true"
      onClick={onClick}
      className="block w-full cursor-pointer border-2 border-[#120c22]"
      style={{ aspectRatio: `${TREE_WIDTH} / ${TREE_HEIGHT}` }}
    />
  )
}
