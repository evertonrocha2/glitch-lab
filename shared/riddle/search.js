// Matching what a player types in the guess box. Accents and case don't matter, so "sao" finds "São".
export const normalize = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

// Items whose name or an alias starts with the query come first, then any that contain it.
// An empty query lists everything, alphabetically.
export function searchItems(query, list) {
  const needle = normalize(query)
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name))
  if (!needle) return sorted
  // Best match first: an exact name, id or alias, then names that start with it, then aliases that
  // do, then anything containing it. So "ts" is TypeScript (not T-SQL) and "f" is F# (not Flutter's Dart).
  const words = (item) => [item.name, item.id, ...(item.aliases ?? [])].map(normalize)
  const tier = (item) => {
    const all = words(item)
    if (all.includes(needle)) return 0
    if (normalize(item.name).startsWith(needle) || normalize(item.id).startsWith(needle)) return 1
    if (all.some((word) => word.startsWith(needle))) return 2
    if (all.some((word) => word.includes(needle))) return 3
    return null
  }
  return sorted
    .map((item) => ({ item, rank: tier(item) }))
    .filter(({ rank }) => rank !== null)
    .sort((a, b) => a.rank - b.rank)
    .map(({ item }) => item)
}
