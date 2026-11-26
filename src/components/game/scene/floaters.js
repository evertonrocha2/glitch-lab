// Floating combat numbers drawn over the pixel scene. Pure data in, canvas calls out.
// A floater is { kind, text?, key?, color, big, amount?, ms }. The scene gives each an `age` (0..1) and an anchor.

export const FLOATER_MS = 900
export const FLOATER_RISE = 14 // px drifted over its life (not with reduced motion)

export const ELEMENT_COLORS = {
  physical: '#f3efe0',
  fire: '#ff8a3d',
  ice: '#7fd8ff',
  lightning: '#ffe45e',
  poison: '#8bdc5a',
}

export const KIND_COLORS = {
  crit: '#ffd23f',
  heal: '#5fe08a',
  mana: '#6fa8ff',
  shield: '#9ad7ff',
  dodge: '#d9d4ff',
  hit: '#ffffff',
  enemyHit: '#ff6b6b',
  enrage: '#ff4d4d',
  phase: '#ffffff',
}

export const elementColor = (element) => ELEMENT_COLORS[element] ?? ELEMENT_COLORS.physical

// Where a floater sits: over the head of its target. x, y is the actor's tile top left; bosses are taller.
export function floaterAnchor(x, y, { boss = false } = {}) {
  return { x: x + 8, y: y - (boss ? 18 : 2) }
}

// age 0..1. Normal motion: rises, fading in the last third. Reduced motion: stays put, still fades.
export function floaterPose(age, { reduced = false } = {}) {
  const a = Math.min(1, Math.max(0, age))
  return {
    dy: reduced ? 0 : -Math.round(FLOATER_RISE * a),
    alpha: a < 0.6 ? 1 : Math.max(0, 1 - (a - 0.6) / 0.4),
  }
}

// ctx: a 2D context. active: [{ floater, age, x, y }]. translate: (key) => label.
export function paintFloaters(ctx, active, { reduced = false, translate = (key) => key } = {}) {
  if (!ctx?.fillText) return
  const prevAlpha = ctx.globalAlpha
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.lineJoin = 'round'
  active.forEach(({ floater, age, x, y }, i) => {
    const { dy, alpha } = floaterPose(age, { reduced })
    const text = floater.key ? translate(floater.key) : (floater.text ?? '')
    // Several at once fan out sideways so they do not overlap.
    const fan = ((i % 3) - 1) * 12
    const lift = (i % 3) * 6
    ctx.globalAlpha = alpha
    ctx.font = `bold ${floater.big ? 14 : 10}px monospace`
    ctx.lineWidth = 3
    ctx.strokeStyle = '#1a1030'
    ctx.strokeText?.(text, x + fan, y + dy - lift)
    ctx.fillStyle = floater.color
    ctx.fillText(text, x + fan, y + dy - lift)
  })
  ctx.globalAlpha = prevAlpha
}
