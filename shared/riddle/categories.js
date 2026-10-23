import { DATABASES } from './catalogs/databases.js'
import { FRAMEWORKS } from './catalogs/frameworks.js'
import { ATTRIBUTES as LANGUAGE_ATTRIBUTES, LABELS as LANGUAGE_LABELS, LANGUAGES, languageById } from './languages.js'

export { searchItems } from './search.js'

// Glitchdle's categories: languages (three modes) and the classic-only ones built from public data
// (scripts/sync-glitchdle.mjs writes catalogs/*.js from Wikidata and Stack Overflow). Public on
// purpose, like languages.js: the browser needs the items for the guess box and the labels. Which
// item is today's answer lives only on the server.
//
// Attribute kinds, graded in shared/riddle/game.js:
// - 'set': lists; 'partial' when they share something.
// - 'one': a single value; 'partial' when both sit in the same family (MIT and BSD are both permissive).
// - 'year': arrows say if the answer is newer or older.
// - 'rank': ordered buckets; arrows say if the answer ranks higher or lower.

const languageName = (id) => languageById(id)?.name ?? id

export const AREAS = ['frontend', 'backend', 'mobile', 'desktop', 'data', 'testing', 'games']
export const KINDS = ['framework', 'library']
export const MAKERS = ['big-tech', 'company', 'foundation', 'community']
export const LICENSES = ['mit', 'apache', 'bsd', 'permissive', 'gpl', 'weak-copyleft', 'source-available', 'proprietary']
export const MODELS = ['relational', 'document', 'key-value', 'wide-column', 'columnar', 'graph', 'time-series', 'search', 'vector']
export const QUERIES = ['sql', 'sql-dialect', 'document-api', 'graph-language', 'key-commands', 'own-language']
export const HOSTING = ['server', 'embedded', 'cloud']
export const POPULARITY = ['niche', 'known', 'popular', 'huge']

const LICENSE_FAMILY = {
  mit: 'permissive',
  apache: 'permissive',
  bsd: 'permissive',
  permissive: 'permissive',
  gpl: 'copyleft',
  'weak-copyleft': 'copyleft',
  'source-available': 'closed',
  proprietary: 'closed',
}
const MAKER_FAMILY = { 'big-tech': 'corporate', company: 'corporate', foundation: 'open', community: 'open' }
// What a framework is written in for its users: JavaScript and TypeScript are one family.
const FRONT_FAMILY = { javascript: 'js', typescript: 'js' }
// What a database is written in: C and C++ are one family, and so are the JVM languages.
const ENGINE_FAMILY = { c: 'c', cpp: 'c', java: 'jvm', scala: 'jvm', kotlin: 'jvm' }
const QUERY_FAMILY = { sql: 'sql', 'sql-dialect': 'sql' }

const SHARED_LABELS = {
  mit: 'MIT',
  apache: 'Apache 2.0',
  bsd: 'BSD',
  permissive: 'Other permissive',
  gpl: 'GPL family',
  'weak-copyleft': 'Weak copyleft',
  'source-available': 'Source available',
  proprietary: 'Proprietary',
}

const FRAMEWORK_LABELS = {
  ...SHARED_LABELS,
  frontend: 'Frontend',
  backend: 'Backend',
  mobile: 'Mobile',
  desktop: 'Desktop',
  data: 'Data and ML',
  testing: 'Testing',
  games: 'Games',
  framework: 'Framework',
  library: 'Library',
  'big-tech': 'Big tech',
  company: 'Company',
  foundation: 'Foundation',
  community: 'Community',
  niche: 'Under 5k',
  known: '5k to 25k',
  popular: '25k to 100k',
  huge: '100k+',
}

const DATABASE_LABELS = {
  ...SHARED_LABELS,
  relational: 'Relational',
  document: 'Document',
  'key-value': 'Key-value',
  'wide-column': 'Wide column',
  columnar: 'Columnar',
  graph: 'Graph',
  'time-series': 'Time series',
  search: 'Search',
  vector: 'Vector',
  sql: 'SQL',
  'sql-dialect': 'SQL-like dialect',
  'document-api': 'Document queries',
  'graph-language': 'Graph language',
  'key-commands': 'Key commands',
  'own-language': 'Own language',
  server: 'Server',
  embedded: 'Embedded',
  cloud: 'Cloud only',
  undisclosed: 'Not public',
  niche: 'Under 2k',
  known: '2k to 15k',
  popular: '15k to 100k',
  huge: '100k+',
}

// Stack Overflow questions per bucket, per category: the lower bound of each bucket after 'niche'.
// Chosen so each bucket holds a fair share of the catalog.
export const POPULARITY_STEPS = {
  frameworks: [5_000, 25_000, 100_000],
  databases: [2_000, 15_000, 100_000],
}

export const CATEGORIES = [
  {
    id: 'languages',
    modes: ['classic', 'error', 'snippet'],
    items: LANGUAGES,
    attributes: LANGUAGE_ATTRIBUTES,
    labels: LANGUAGE_LABELS,
  },
  {
    id: 'frameworks',
    modes: ['frameworks'],
    items: FRAMEWORKS,
    attributes: [
      { key: 'language', kind: 'one', family: FRONT_FAMILY, values: 'languages' },
      { key: 'area', kind: 'set', values: AREAS },
      { key: 'kind', kind: 'one', values: KINDS },
      { key: 'maker', kind: 'one', family: MAKER_FAMILY, values: MAKERS },
      { key: 'license', kind: 'one', family: LICENSE_FAMILY, values: LICENSES },
      { key: 'popularity', kind: 'rank', values: POPULARITY },
      { key: 'year', kind: 'year' },
    ],
    labels: FRAMEWORK_LABELS,
  },
  {
    id: 'databases',
    modes: ['databases'],
    items: DATABASES,
    attributes: [
      { key: 'model', kind: 'set', values: MODELS },
      { key: 'query', kind: 'one', family: QUERY_FAMILY, values: QUERIES },
      { key: 'writtenIn', kind: 'one', family: ENGINE_FAMILY, values: 'languages' },
      { key: 'license', kind: 'one', family: LICENSE_FAMILY, values: LICENSES },
      { key: 'hosting', kind: 'one', values: HOSTING },
      { key: 'popularity', kind: 'rank', values: POPULARITY },
      { key: 'year', kind: 'year' },
    ],
    labels: DATABASE_LABELS,
  },
]

const BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]))
const ITEMS = new Map(CATEGORIES.map((category) => [category.id, new Map(category.items.map((item) => [item.id, item]))]))

export const categoryById = (id) => BY_ID.get(id) ?? null
export const itemById = (categoryId, id) => ITEMS.get(categoryId)?.get(id) ?? null

// Every board a day has, one slot each in the store: the language modes, then a slot per other category.
export const SLOTS = CATEGORIES.flatMap((category) => category.modes)
export const categoryOfSlot = (slot) => CATEGORIES.find((category) => category.modes.includes(slot)) ?? null
// Slots graded on traits, a card per guess: Classic and every non-language category.
export const CLASSIC_SLOTS = ['classic', ...CATEGORIES.slice(1).flatMap((category) => category.modes)]

// What a value reads like on a cell, in English: language ids read as the language's name.
export function valueLabel(categoryId, value) {
  const category = BY_ID.get(categoryId)
  if (!category) return String(value)
  return category.labels[value] ?? (languageById(value) ? languageName(value) : String(value))
}
