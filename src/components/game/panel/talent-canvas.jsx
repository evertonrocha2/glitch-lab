import { useEffect, useRef } from 'react'
import { TALENTS, TREE_HEIGHT, TREE_WIDTH } from '../../../../shared/game/talents.js'
import { iconCanvas } from '../icons/sprite.js'
import { useReducedMotion } from '../use-reduced-motion.js'

// The talent tree drawn like the approved mockup (game-depth.html, #tree): owned path in gold, nodes
// you can take now glowing (a still white outline with reduced motion), queued nodes in cyan,
// keystones octagonal with a 2x icon. The canvas is decoration plus a mouse target: the tab's hidden
// node list is the accessible version, so the canvas is aria-hidden.

export const BRANCH_COLORS = { logica: '#ff5a6e', sintaxe: '#5fd38a', algoritmos: '#a98bff', bridge: '#f2c14e', root: '#f2c14e' }
const RADIUS = { root: 20, small: 8, notable: 15, keystone: 22 }
const QUEUED = '#7fffe9'
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

function shape(ctx, node, r) {
  ctx.beginPath()
  if (node.kind === 'keystone') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      ctx[i ? 'lineTo' : 'moveTo'](node.x + Math.cos(a) * r, node.y + Math.sin(a) * r)
    }
    ctx.closePath()
  } else ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
}

// One frame. state: { owned, queued, open (Sets of ids), selected, labels }. t: seconds, or null when
// still (reduced motion).
export function drawTree(ctx, { owned, queued, open, selected, labels }, t) {
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
    if (node.kind !== 'small') {
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

  ctx.textAlign = 'center'
  for (const key of KEYSTONES) {
    const label = labels?.[key.branch]
    if (!label) continue
    const y = key.y - 42
    ctx.font = 'bold 14px ui-monospace, Menlo, monospace'
    ctx.fillStyle = BRANCH_COLORS[key.branch]
    ctx.fillText(label.name, key.x, y)
    ctx.font = '10px ui-monospace, Menlo, monospace'
    ctx.fillStyle = '#9a93b8'
    ctx.fillText(label.sub, key.x, y + 13)
  }
}

// Props: owned, queued, open (Sets of node ids), selected (id or null), labels ({ [branch]: { name, sub } }),
// onSelect(id).
export default function TalentCanvas({ owned, queued, open, selected, labels, onSelect }) {
  const ref = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return undefined
    ctx.imageSmoothingEnabled = false
    const state = { owned, queued, open, selected, labels }
    if (reduced) {
      drawTree(ctx, state, null)
      return undefined
    }
    let frame = 0
    const loop = (ms) => {
      drawTree(ctx, state, ms / 1000)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [owned, queued, open, selected, labels, reduced])

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
      className="block w-full cursor-pointer border-2 border-[#2e2650]"
      style={{ aspectRatio: `${TREE_WIDTH} / ${TREE_HEIGHT}` }}
    />
  )
}
