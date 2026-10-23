import { AREAS, categoryById, MODELS, POPULARITY, POPULARITY_STEPS } from '../../shared/riddle/categories.js'
import { LANGUAGES } from '../../shared/riddle/languages.js'
import { normalize } from '../../shared/riddle/search.js'

// Turns what Wikidata and Stack Overflow say into Glitchdle's trait vocabulary. Pure functions, so
// the tests run them on recorded answers. Each rule reads English labels (Wikidata's "type" and
// "license" names) because they're stable and readable; the overrides fix what the rules get wrong.

const MIN_YEAR = 1970

// ---- Wikidata rows -> one record per item ---------------------------------------------------

const qid = (uri) => uri.split('/').pop()

// The resolve query's rows -> { tag: qid }. A pinned id wins, then a tag stored on the item
// (P1482), then the item whose English label matches the seed's, the most linked one when several do.
export function resolveItems(seeds, rows) {
  const byTag = new Map()
  const byLabel = new Map()
  for (const row of rows) {
    const item = { id: qid(row.item.value), sitelinks: Number(row.sitelinks?.value ?? 0) }
    const pool = row.tag ? byTag : byLabel
    const key = row.tag ? row.tag.value.split('/tags/')[1] : row.label.value
    const best = pool.get(key)
    if (!best || item.sitelinks > best.sitelinks) pool.set(key, item)
  }
  return Object.fromEntries(seeds.map(([tag, label, pinned]) => [tag, pinned ?? (byTag.get(tag) ?? byLabel.get(label))?.id ?? null]).filter(([, id]) => id))
}

// The facts query's rows -> { qid: { name, namePt, alias[], inception[], ... } }.
export function groupFacts(rows) {
  const items = {}
  for (const row of rows) {
    const id = qid(row.item.value)
    items[id] ??= {}
    const list = items[id][row.fact.value] ?? []
    if (!list.includes(row.value.value)) list.push(row.value.value)
    items[id][row.fact.value] = list
  }
  return items
}

// ---- Shared rules ----------------------------------------------------------------------------

const LANGUAGE_IDS = new Map([
  ...LANGUAGES.flatMap((item) => [item.name, item.id, ...item.aliases].map((word) => [normalize(word), item.id])),
  ['apache groovy', 'groovy'],
  ['visual basic .net', 'vbnet'],
])
export const languageIds = (labels = []) => [...new Set(labels.map((label) => LANGUAGE_IDS.get(normalize(label))).filter(Boolean))]
const firstBy = (order, ids) => order.find((id) => ids.includes(id)) ?? null

// The first release: the earliest inception or publication date, or an early version's date (0.x
// or 1.x) when neither is there. Years before 1970 or after this one are someone's typo.
export function firstYear(facts, thisYear) {
  const dates = [...(facts.inception ?? []), ...(facts.published ?? [])]
  const pool = dates.length ? dates : (facts.earlyRelease ?? [])
  const years = pool.map((date) => Number(String(date).slice(0, 4))).filter((year) => year >= MIN_YEAR && year <= thisYear)
  return years.length ? Math.min(...years) : null
}

// A license name -> a bucket. Order matters: "Lesser General Public" before "General Public".
const LICENSE_RULES = [
  [/server side public|business source|elastic license|source.available|commons clause|redis source/i, 'source-available'],
  [/proprietary|end-user license|freeware|commercial/i, 'proprietary'],
  [/lesser general public|mozilla public|eclipse public|common public|cddl|common development and distribution|interbase public/i, 'weak-copyleft'],
  [/general public license|\bgpl\b|affero/i, 'gpl'],
  [/^mit\b|\bmit license|expat|x11 license/i, 'mit'],
  [/apache/i, 'apache'],
  [/bsd/i, 'bsd'],
  [/public domain|postgresql license|zlib|isc license|unlicense|boost software|matplotlib license|python software foundation/i, 'permissive'],
]
// When an item lists several, the most permissive open one names it: that's the one anyone can
// pick (RocksDB is "GPLv2 or Apache 2.0", MySQL is GPL or a commercial license).
const LICENSE_ORDER = ['apache', 'mit', 'bsd', 'permissive', 'weak-copyleft', 'gpl', 'source-available', 'proprietary']
export function licenseOf(labels = []) {
  const buckets = labels.map((label) => LICENSE_RULES.find(([rule]) => rule.test(label))?.[1]).filter(Boolean)
  return firstBy(LICENSE_ORDER, buckets)
}

// Who makes it, from the developer, owner and publisher on record. A household tech name is
// 'big-tech'; any other company 'company'; foundations and nonprofits 'foundation'; people or
// nobody on record 'community'.
const BIG_TECH = /^(google|google brain|deepmind|meta platforms|facebook|microsoft|apple|amazon|amazon web services|oracle corporation|ibm|intel|nvidia|sun microsystems|sap|adobe|alibaba|tencent|baidu|netflix|twitter|linkedin|salesforce|github|yahoo!?)\b/i
export function makerOf(facts) {
  if ((facts.developer ?? []).some((name) => BIG_TECH.test(name))) return 'big-tech'
  const types = facts.developerType ?? []
  if (types.some((type) => /company|business|enterprise|corporat|research group/i.test(type))) return 'company'
  if (types.some((type) => /foundation|nonprofit|non-profit|charitab|consortium|open-source project|university/i.test(type))) return 'foundation'
  return 'community'
}

// Stack Overflow questions -> a bucket, with steps per category.
export function popularityOf(count, steps) {
  if (!Number.isFinite(count)) return null
  return POPULARITY[steps.filter((step) => count >= step).length]
}

// Search words besides the name: the Stack Overflow tag, the Portuguese name when it differs, and
// English aliases that look like a name for the same thing (a word of the name, or its initials).
// Wikidata aliases also hold old code names and jokes ("cute" for Qt), so the rest are left out.
export function aliasesOf(name, tag, facts) {
  const words = normalize(name).split(/[^a-z0-9#+]+/).filter((word) => word.length >= 2)
  const initials = normalize(name)
    .split(/[\s.-]+/)
    .map((word) => word[0])
    .join('')
  const looksRight = (alias) => {
    const text = normalize(alias)
    return text.length >= 2 && text.length <= 30 && /[a-z]/.test(text) && (words.some((word) => text.includes(word)) || text === initials)
  }
  const ptNames = (facts.namePt ?? []).map((value) => value.replace(/\s*\(.*\)$/, ''))
  const all = [tag, ...ptNames, ...(facts.alias ?? []).filter(looksRight)]
  const seen = new Set([normalize(name)])
  return all.filter((alias) => {
    const key = normalize(alias)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 5)
}

// Ids come from the seed's name, which we write, so a rename on Wikidata never changes them.
export const idOf = (label) => normalize(label).replace(/\+/g, 'p').replace(/#/g, 'sharp').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ---- Frameworks ------------------------------------------------------------------------------

// The language a framework's users write: the higher-level one when Wikidata lists the engine
// language too (TensorFlow lists C++ and Python; people write Python).
const FRAMEWORK_LANGUAGE_ORDER = ['javascript', 'typescript', 'python', 'ruby', 'php', 'dart', 'java', 'kotlin', 'scala', 'csharp', 'swift', 'go', 'elixir', 'rust', 'cpp', 'c']

const AREA_RULES = [
  [/test/i, 'testing'],
  [/object.relational|\borm\b|data access/i, 'backend'],
  [/game engine|video game/i, 'games'],
  [/mobile/i, 'mobile'],
  [/widget toolkit|gui|desktop/i, 'desktop'],
  [/machine learning|deep learning|numerical|mathematical|plotting|visuali[sz]ation|scientific|research software|data analysis|big data|cloud computing/i, 'data'],
  [/javascript (library|framework)|front.end|css|user interface/i, 'frontend'],
]
const SERVER_LANGUAGES = new Set(['python', 'ruby', 'php', 'java', 'kotlin', 'scala', 'csharp', 'go', 'elixir', 'rust'])

// types: what Wikidata says the item is (P31) and what it's used for (P366).
export function areasOf(types = [], language) {
  const areas = new Set(types.flatMap((type) => AREA_RULES.filter(([rule]) => rule.test(type)).map(([, area]) => area)))
  // A web framework is backend in a server language; in JavaScript it's frontend unless overridden.
  if (types.some((type) => /web framework|microframework/i.test(type))) areas.add(SERVER_LANGUAGES.has(language) ? 'backend' : 'frontend')
  return AREAS.filter((area) => areas.has(area))
}

export function kindOf(types = []) {
  if (types.some((type) => /framework|engine|platform/i.test(type))) return 'framework'
  if (types.some((type) => /library|package|toolkit|api|software/i.test(type))) return 'library'
  return null
}

export function normalizeFramework({ label, facts, count, thisYear }) {
  const language = firstBy(FRAMEWORK_LANGUAGE_ORDER, languageIds(facts.language))
  return {
    id: idOf(label),
    name: facts.name?.[0] ?? label,
    language,
    area: areasOf([...(facts.type ?? []), ...(facts.use ?? [])], language),
    kind: kindOf(facts.type),
    maker: makerOf(facts),
    license: licenseOf(facts.license),
    popularity: popularityOf(count, POPULARITY_STEPS.frameworks),
    year: firstYear(facts, thisYear),
  }
}

// ---- Databases -------------------------------------------------------------------------------

// What a database engine is written in: the systems language when several are listed (MongoDB's
// shell is JavaScript; the server is C++).
const ENGINE_LANGUAGE_ORDER = ['go', 'rust', 'cpp', 'c', 'java', 'scala', 'erlang', 'csharp', 'javascript', 'python']

const MODEL_RULES = [
  [/relational|sql server|newsql/i, 'relational'],
  [/document/i, 'document'],
  [/key.value|cache/i, 'key-value'],
  [/wide.column/i, 'wide-column'],
  [/column.oriented|columnar|data warehouse|olap/i, 'columnar'],
  [/graph database/i, 'graph'],
  [/time.series/i, 'time-series'],
  [/search engine/i, 'search'],
  [/vector database/i, 'vector'],
]
export function modelsOf(types = []) {
  const found = new Set(types.flatMap((type) => MODEL_RULES.filter(([rule]) => rule.test(type)).map(([, model]) => model)))
  return MODELS.filter((model) => found.has(model))
}

// How you ask it things, from its main model; the overrides name the exceptions (Cassandra's CQL).
const QUERY_BY_MODEL = [
  ['relational', 'sql'],
  ['columnar', 'sql'],
  ['graph', 'graph-language'],
  ['document', 'document-api'],
  ['search', 'document-api'],
  ['time-series', 'sql-dialect'],
  ['wide-column', 'sql-dialect'],
  ['key-value', 'key-commands'],
  ['vector', 'document-api'],
]
export const queryOf = (models) => QUERY_BY_MODEL.find(([model]) => models.includes(model))?.[1] ?? null

export function hostingOf(types = []) {
  if (types.some((type) => /serverless|embedded|in-process|embeddable/i.test(type))) return 'embedded'
  if (types.some((type) => /cloud database|software as a service|database as a service|cloud computing/i.test(type))) return 'cloud'
  return 'server'
}

// A cloud-only service publishes neither a license nor its source: it's proprietary. Closed
// software doesn't say what it's written in either.
export function normalizeDatabase({ label, facts, count, thisYear }) {
  const model = modelsOf([...(facts.type ?? []), ...(facts.use ?? [])])
  const hosting = hostingOf(facts.type)
  const license = licenseOf(facts.license) ?? (hosting === 'cloud' ? 'proprietary' : null)
  return {
    id: idOf(label),
    name: facts.name?.[0] ?? label,
    model,
    query: queryOf(model),
    license,
    writtenIn: firstBy(ENGINE_LANGUAGE_ORDER, languageIds(facts.language)) ?? (license === 'proprietary' ? 'undisclosed' : null),
    hosting,
    popularity: popularityOf(count, POPULARITY_STEPS.databases),
    year: firstYear(facts, thisYear),
  }
}

// ---- Validation and the whole pipeline -------------------------------------------------------

// 'undisclosed': a closed service doesn't say what it's written in.
const LANGUAGE_SET = new Set([...LANGUAGES.map((item) => item.id), 'undisclosed'])

// What's wrong with an item, as short reasons; empty when every trait is filled with a known value.
export function problemsOf(item, categoryId, thisYear) {
  const problems = []
  if (!item.name) problems.push('no name')
  for (const { key, kind, values } of categoryById(categoryId).attributes) {
    const value = item[key]
    const allowed = values === 'languages' ? LANGUAGE_SET : new Set(values ?? [])
    if (kind === 'year') {
      if (!Number.isInteger(value) || value < MIN_YEAR || value > thisYear) problems.push(`no ${key}`)
    } else if (kind === 'set') {
      if (!Array.isArray(value) || value.length === 0) problems.push(`no ${key}`)
      else if (!value.every((entry) => allowed.has(entry))) problems.push(`unknown ${key}`)
    } else if (value == null) problems.push(`no ${key}`)
    else if (!allowed.has(value)) problems.push(`unknown ${key} ${value}`)
  }
  return problems
}

const NORMALIZERS = { frameworks: normalizeFramework, databases: normalizeDatabase }

// Everything for one category: { items (sorted by id), dropped: [{ tag, reasons }] }.
// overrides: { tag: { ...fields, drop?: 'why' } }, applied on top of the data.
export function buildCatalog({ categoryId, seeds, resolveRows, factRows, counts, overrides = {}, thisYear }) {
  const resolved = resolveItems(seeds, resolveRows)
  const facts = groupFacts(factRows)
  const questions = new Map(counts.map(({ name, count }) => [name, count]))
  const items = []
  const dropped = []
  for (const [tag, label] of seeds) {
    const fix = overrides[tag] ?? {}
    if (fix.drop) {
      dropped.push({ tag, reasons: [fix.drop] })
      continue
    }
    const wikidata = resolved[tag]
    if (!wikidata) {
      dropped.push({ tag, reasons: ['not on Wikidata'] })
      continue
    }
    const count = questions.get(tag)
    const { aliases: extraAliases = [], ...fields } = fix
    const base = NORMALIZERS[categoryId]({ label, facts: facts[wikidata] ?? {}, count, thisYear })
    const item = { ...base, ...fields }
    const reasons = [...problemsOf(item, categoryId, thisYear), ...(Number.isFinite(count) ? [] : ['no Stack Overflow tag'])]
    if (reasons.length) {
      dropped.push({ tag, reasons })
      continue
    }
    const aliases = [...new Set([...aliasesOf(item.name, tag, facts[wikidata] ?? {}), ...extraAliases])]
    items.push({ ...item, aliases, questions: count, wikidata })
  }
  // Two seeds can land on the same item (spring and spring-boot are different, but a rename could merge them).
  const seen = new Set()
  const unique = items.filter((item) => {
    if (seen.has(item.wikidata) || seen.has(item.id)) {
      dropped.push({ tag: item.id, reasons: ['duplicate item'] })
      return false
    }
    seen.add(item.wikidata)
    seen.add(item.id)
    return true
  })
  return { items: unique.sort((a, b) => a.id.localeCompare(b.id)), dropped }
}
