// The hero's look: six small indexes. The renderer maps each to colors and shapes; the server only
// checks the ranges. Pure, so the client creator and the server agree.

export const LOOK_OPTIONS = { skin: 5, hairStyle: 6, hairColor: 8, eyeStyle: 4, eyeColor: 4, outfit: 8 }

export const DEFAULT_LOOK = { skin: 0, hairStyle: 0, hairColor: 0, eyeStyle: 0, eyeColor: 0, outfit: 0 }

const FIELDS = Object.keys(LOOK_OPTIONS)

const isIndex = (value, count) => Number.isInteger(value) && value >= 0 && value < count

// Exactly these six integer fields in range. Extra fields are ignored.
export const isLook = (body) =>
  typeof body === 'object' && body !== null && FIELDS.every((field) => isIndex(body[field], LOOK_OPTIONS[field]))

// Always a valid look. A current look keeps its good fields; the old { hood, outfit, hair } keeps
// outfit and hair (as hairColor); anything else becomes the default.
export function normalizeLook(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...DEFAULT_LOOK }
  const look = { ...DEFAULT_LOOK }
  for (const field of FIELDS) if (isIndex(raw[field], LOOK_OPTIONS[field])) look[field] = raw[field]
  if (!isIndex(raw.hairColor, LOOK_OPTIONS.hairColor) && isIndex(raw.hair, LOOK_OPTIONS.hairColor)) look.hairColor = raw.hair
  return look
}

// rng comes from createRng (shared/game/rng.js).
export const randomLook = (rng) => Object.fromEntries(FIELDS.map((field) => [field, rng.int(LOOK_OPTIONS[field])]))
