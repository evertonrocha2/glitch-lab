// The bug types the AI tags each case with. The board groups by them and the gym trains on them.
export const CONCEPTS = [
  { id: 'undefined-access', label: 'Reading undefined' },
  { id: 'index-out-of-range', label: 'Index out of range' },
  { id: 'not-defined', label: 'Not defined' },
  { id: 'type-mismatch', label: 'Wrong type' },
  { id: 'off-by-one', label: 'Off by one' },
  { id: 'indentation-syntax', label: 'Indentation or syntax' },
  { id: 'missing-return', label: 'Missing return' },
  { id: 'wrong-comparison', label: 'Wrong comparison' },
  { id: 'mutation-reference', label: 'Shared reference' },
  { id: 'async-await', label: 'Async and await' },
  { id: 'key-error', label: 'Missing key' },
  { id: 'other', label: 'Other' },
]

export function conceptLabel(id) {
  return CONCEPTS.find((concept) => concept.id === id)?.label ?? 'Other'
}
