export const IDENTICON_SIZE = 8
const HALF = IDENTICON_SIZE / 2
const MIN_HALF = 6
const MAX_HALF = 26

// FNV-1a: turns the seed into a 32-bit number.
function hash(seed) {
  let value = 0x811c9dc5
  for (const char of seed) {
    value ^= char.codePointAt(0)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

// mulberry32: a tiny repeatable random number generator.
function generator(start) {
  let state = start
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// An 8x8 grid of booleans (true = filled), the same every time for the same seed.
// The left half is random and mirrored onto the right, so it reads like a little face or creature.
export function identicon(seed) {
  const random = generator(hash(String(seed)))
  let half
  // Redraw the rare pictures that come out almost empty or almost solid.
  do {
    half = Array.from({ length: IDENTICON_SIZE }, () => Array.from({ length: HALF }, () => random() < 0.5))
  } while (!isBalanced(half))
  return half.map((row) => [...row, ...[...row].reverse()])
}

function isBalanced(half) {
  const count = half.flat().filter(Boolean).length
  return count >= MIN_HALF && count <= MAX_HALF
}
