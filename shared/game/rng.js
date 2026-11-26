// Seeded random numbers for the game rules. Same seed, same stream, on server and client.

// cyrb53 turns any string into a 53-bit number, so similar seeds still land far apart.
const hash = (str) => {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

// mulberry32 is tiny and fast, and good enough for game rolls.
const mulberry32 = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const createRng = (seed) => {
  const base = String(seed)
  const next = mulberry32(hash(base))
  const int = (n) => Math.floor(next() * n)
  return {
    next,
    int,
    pick: (list) => list[int(list.length)],
    chance: (p) => next() < p,
    weighted(weights) {
      const entries = Object.entries(weights)
      let roll = next() * entries.reduce((sum, [, w]) => sum + w, 0)
      for (const [key, w] of entries) {
        roll -= w
        if (roll < 0) return key
      }
      return entries[entries.length - 1][0]
    },
    // The fork has its own stream and never touches the parent's position.
    fork: (label) => createRng(`${base}/${label}`),
  }
}
