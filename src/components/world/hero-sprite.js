// The Glitch World hero: 8x8 pixels, one character per pixel. H is the player's avatar color, k is ink,
// w is white and . is see-through. Two frames per direction: standing and mid-step.
const LEGS = ['..k..k..', '.k....k.']

const body = (top) => [...top, '..kHHk..', '.kHHHHk.', '.kHHHHk.']

const DOWN = body(['..kkkk..', '.kHHHHk.', '.kwkkwk.', '.kwwwwk.'])
const UP = body(['..kkkk..', '.kHHHHk.', '.kHHHHk.', '.kHHHHk.'])
const LEFT = body(['..kkkk..', '.kHHHHk.', '.kwkHHk.', '.kwwHHk.'])
const RIGHT = LEFT.map((line) => [...line].reverse().join(''))

const frames = (top) => LEGS.map((legs) => [...top, legs])

export const HERO_FRAMES = { down: frames(DOWN), up: frames(UP), left: frames(LEFT), right: frames(RIGHT) }

// A padlock, drawn small on the door of a zone that's still locked (y is gold).
export const LOCK = ['..kkkk..', '.k....k.', '.k....k.', 'kkkkkkkk', 'kyyyyyyk', 'kyyykyyk', 'kyyyyyyk', 'kkkkkkkk']
// Plain colors: a CSS variable doesn't work in a fill attribute.
export const LOCK_COLORS = { k: '#1c1d26', y: '#e0a030' }
