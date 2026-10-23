import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// The two public sources the Glitchdle catalogs come from. Both are free and need no key:
// - Wikidata's SPARQL endpoint (CC0): what each item is, its language, license, maker and year.
// - The Stack Exchange API (CC BY-SA): how many Stack Overflow questions each tag has.
// One request per category and source, and every answer is cached on disk, so running the sync
// again the same day asks nothing (and a rerun after a fix to the normalizer is free).

export const USER_AGENT = 'GlitchLab-Glitchdle-sync/1.0 (https://github.com/evertonrocha2/glitch-detective; study project)'
const WIKIDATA = 'https://query.wikidata.org/sparql'
const STACK_EXCHANGE = 'https://api.stackexchange.com/2.3/tags'
// The API takes up to 100 tags per request.
const TAGS_PER_REQUEST = 100

export const tagUri = (tag) => `https://stackoverflow.com/tags/${tag}`

const literal = (text) => JSON.stringify(text)

// Finds each seed's item: by its Stack Overflow tag (P1482) or, for items without one, by English
// name, among items that look like software (a language, license, version, repository or developer).
export function buildResolveQuery(seeds) {
  const tags = seeds.map(([tag]) => `<${tagUri(tag)}>`).join(' ')
  const labels = seeds.map(([, label]) => `${literal(label)}@en`).join(' ')
  return `SELECT DISTINCT ?tag ?label ?item ?sitelinks WHERE {
  {
    VALUES ?tag { ${tags} }
    ?item wdt:P1482 ?tag .
  } UNION {
    VALUES ?label { ${labels} }
    ?item rdfs:label ?label .
    # A join, not FILTER EXISTS: the endpoint times out on the filter with many labels.
    ?item wdt:P277|wdt:P275|wdt:P348|wdt:P1324|wdt:P178 ?any .
  }
  ?item wikibase:sitelinks ?sitelinks .
}`
}

// One row per (item, fact): UNION branches instead of OPTIONALs, so an item with 3 types and 4
// licenses gives 7 rows and not 12. Labels come back in English (the normalizer's vocabulary) and
// the item's own names in English and Portuguese. Owner and publisher count as the maker too.
export function buildFactsQuery(ids) {
  const values = ids.map((id) => `wd:${id}`).join(' ')
  return `SELECT ?item ?fact ?value WHERE {
  VALUES ?item { ${values} }
  {
    { ?item rdfs:label ?value FILTER(LANG(?value) = "en") BIND("name" AS ?fact) }
    UNION { ?item rdfs:label ?value FILTER(LANG(?value) IN ("pt-br", "pt")) BIND("namePt" AS ?fact) }
    UNION { ?item skos:altLabel ?value FILTER(LANG(?value) = "en") BIND("alias" AS ?fact) }
    UNION { ?item wdt:P571 ?value BIND("inception" AS ?fact) }
    UNION { ?item wdt:P577 ?value BIND("published" AS ?fact) }
    UNION { ?item wdt:P31 ?type . ?type rdfs:label ?value FILTER(LANG(?value) = "en") BIND("type" AS ?fact) }
    UNION { ?item wdt:P366 ?use . ?use rdfs:label ?value FILTER(LANG(?value) = "en") BIND("use" AS ?fact) }
    UNION { ?item wdt:P277 ?language . ?language rdfs:label ?value FILTER(LANG(?value) = "en") BIND("language" AS ?fact) }
    UNION { ?item wdt:P275 ?license . ?license rdfs:label ?value FILTER(LANG(?value) = "en") BIND("license" AS ?fact) }
    UNION { ?item p:P348 ?version . ?version ps:P348 ?number ; pq:P577 ?value FILTER(REGEX(STR(?number), "^[01]([.]|$)")) BIND("earlyRelease" AS ?fact) }
    UNION { ?item wdt:P178|wdt:P127|wdt:P123 ?developer . ?developer rdfs:label ?value FILTER(LANG(?value) = "en") BIND("developer" AS ?fact) }
    UNION { ?item wdt:P178|wdt:P127|wdt:P123 ?developer . ?developer wdt:P31 ?kind . ?kind rdfs:label ?value FILTER(LANG(?value) = "en") BIND("developerType" AS ?fact) }
  }
}`
}

async function sparql(query, cacheDir) {
  return cached(cacheDir, `wikidata:${query}`, async () => {
    // POST keeps a long VALUES list out of the URL.
    const body = await getJson(WIKIDATA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
      body: new URLSearchParams({ query }),
    })
    return body.results.bindings
  })
}

async function cached(cacheDir, key, load) {
  const file = join(cacheDir, `${createHash('sha1').update(key).digest('hex').slice(0, 16)}.json`)
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    const fresh = await load()
    await mkdir(cacheDir, { recursive: true })
    await writeFile(file, JSON.stringify(fresh))
    return fresh
  }
}

async function getJson(url, init) {
  const res = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...init?.headers }, signal: AbortSignal.timeout(90_000) })
  if (!res.ok) throw new Error(`${url.split('?')[0]} answered ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

// The raw SPARQL rows for a category's seeds. resolve: which item each seed is; facts: what those
// items are. ids(resolveRows) picks the item ids to ask facts about.
export async function fetchWikidata(seeds, { cacheDir, ids }) {
  const resolveRows = await sparql(buildResolveQuery(seeds), cacheDir)
  const factRows = await sparql(buildFactsQuery(ids(resolveRows)), cacheDir)
  return { resolveRows, factRows }
}

// [{ name, count }] for the tags Stack Overflow knows.
export async function fetchTagCounts(tags, { cacheDir }) {
  const items = []
  for (let start = 0; start < tags.length; start += TAGS_PER_REQUEST) {
    const chunk = tags.slice(start, start + TAGS_PER_REQUEST)
    const url = `${STACK_EXCHANGE}/${chunk.map(encodeURIComponent).join(';')}/info?site=stackoverflow&pagesize=100`
    const body = await cached(cacheDir, `stackexchange:${url}`, () => getJson(url))
    items.push(...body.items.map(({ name, count }) => ({ name, count })))
  }
  return items
}
