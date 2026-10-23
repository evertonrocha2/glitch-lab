import { interrogationSummary } from '../../../shared/interrogation.js'

// computeProgress's `interrogation` input: { completed }, the cases interrogated from start to end.
// For the interrogation XP and the scientific-method badge.
export async function loadInterrogation(store, userId) {
  return interrogationSummary(await store.listInterrogations(userId))
}
