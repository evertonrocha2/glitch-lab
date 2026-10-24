// Ranked buckets for counts that come from public data: Stack Overflow questions (every board)
// and how many Wikipedias have an article (frameworks and databases). Apart from categories.js so
// languages.js can bucket its own counts without a circular import.

export const POPULARITY = ['niche', 'known', 'popular', 'huge']
export const WIKIPEDIAS = ['low', 'mid', 'high', 'top']

// The lower bound of each bucket after the first, per category. Chosen so each bucket holds a fair
// share of the catalog (scripts/sync-glitchdle.mjs prints the spread).
export const POPULARITY_STEPS = {
  languages: [10_000, 100_000, 1_000_000],
  frameworks: [5_000, 25_000, 100_000],
  databases: [2_000, 15_000, 100_000],
}
export const WIKIPEDIA_STEPS = {
  frameworks: [5, 15, 30],
  databases: [3, 8, 18],
}

// A count -> its bucket, or null when there's no count.
export function bucketOf(count, steps, buckets = POPULARITY) {
  if (!Number.isFinite(count)) return null
  return buckets[steps.filter((step) => count >= step).length]
}
