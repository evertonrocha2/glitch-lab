// Every board a Glitchdle day has, one slot each in the store: the three language modes, then one
// slot per other category. Apart from categories.js so code that only needs the names (game.js,
// the share text, the daily page's teaser) doesn't pull the catalogs into its bundle.
export const CATEGORY_MODES = {
  languages: ['classic', 'error', 'snippet'],
  frameworks: ['frameworks'],
  databases: ['databases'],
}
export const SLOTS = Object.values(CATEGORY_MODES).flat()
