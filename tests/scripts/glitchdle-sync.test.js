// @vitest-environment node
import { readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  aliasesOf,
  areasOf,
  buildCatalog,
  firstYear,
  idOf,
  languageIds,
  licenseOf,
  makerOf,
  modelsOf,
  popularityOf,
  problemsOf,
  resolveItems,
} from '../../scripts/glitchdle/normalize.js'
import { DATABASE_OVERRIDES, FRAMEWORK_OVERRIDES } from '../../scripts/glitchdle/overrides.js'
import { DATABASE_SEEDS, FRAMEWORK_SEEDS } from '../../scripts/glitchdle/seeds.js'
import { buildFactsQuery, buildResolveQuery, fetchTagCounts, USER_AGENT } from '../../scripts/glitchdle/sources.js'

// Recorded answers from Wikidata and the Stack Exchange API (a few items each, trimmed by hand),
// so these tests never touch the network.
const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/glitchdle/${name}.json`, import.meta.url), 'utf8'))

afterEach(() => vi.unstubAllGlobals())

describe('the rules', () => {
  it('maps Wikidata license names to buckets, the most permissive open one first', () => {
    expect(licenseOf(['MIT License'])).toBe('mit')
    expect(licenseOf(['Expat license'])).toBe('mit')
    expect(licenseOf(['3-clause BSD License'])).toBe('bsd')
    expect(licenseOf(['GNU Lesser General Public License, version 3.0', 'GNU General Public License, version 3.0'])).toBe('weak-copyleft')
    expect(licenseOf(['proprietary license', 'GNU General Public License, version 2.0'])).toBe('gpl')
    expect(licenseOf(['GNU General Public License', 'Apache Software License 2.0'])).toBe('apache')
    expect(licenseOf(['Server Side Public License'])).toBe('source-available')
    expect(licenseOf(['released into the public domain by the copyright holder'])).toBe('permissive')
    expect(licenseOf(['Some unknown license'])).toBeNull()
    expect(licenseOf()).toBeNull()
  })

  it('reads the maker from the developer on record', () => {
    expect(makerOf({ developer: ['Meta Platforms'], developerType: ['public company'] })).toBe('big-tech')
    expect(makerOf({ developer: ['VMware'], developerType: ['business', 'enterprise'] })).toBe('company')
    expect(makerOf({ developer: ['Django Software Foundation'], developerType: ['charitable organization'] })).toBe('foundation')
    expect(makerOf({ developer: ['Taylor Otwell'], developerType: ['human'] })).toBe('community')
    expect(makerOf({})).toBe('community')
  })

  it('takes the first release year, ignoring typos and falling back to early versions', () => {
    expect(firstYear({ inception: ['2005-12-13T00:00:00Z'], published: ['2004-07-25T00:00:00Z'] }, 2026)).toBe(2004)
    expect(firstYear({ inception: ['1066-01-01T00:00:00Z', '2010-01-01T00:00:00Z'] }, 2026)).toBe(2010)
    expect(firstYear({ inception: ['2031-01-01T00:00:00Z'] }, 2026)).toBeNull()
    expect(firstYear({ earlyRelease: ['2016-03-01T00:00:00Z', '2015-08-01T00:00:00Z'] }, 2026)).toBe(2015)
    expect(firstYear({}, 2026)).toBeNull()
  })

  it('finds our language ids in Wikidata language names', () => {
    expect(languageIds(['C++', 'Python', 'CUDA', 'C#'])).toEqual(['cpp', 'python', 'csharp'])
    expect(languageIds(['Apache Groovy', 'JSX'])).toEqual(['groovy'])
  })

  it('derives areas and data models from what an item is and is used for', () => {
    expect(areasOf(['web framework'], 'python')).toEqual(['backend'])
    expect(areasOf(['JavaScript library', 'web framework'], 'javascript')).toEqual(['frontend'])
    expect(areasOf(['test automation framework'], 'java')).toEqual(['testing'])
    expect(areasOf(['object–relational mapping'], 'java')).toEqual(['backend'])
    expect(areasOf(['software'], 'java')).toEqual([])
    expect(modelsOf(['relational database management system', 'column-oriented DBMS'])).toEqual(['relational', 'columnar'])
    expect(modelsOf(['key–value database system'])).toEqual(['key-value'])
    expect(modelsOf(['database management system'])).toEqual([])
  })

  it('puts Stack Overflow counts in buckets', () => {
    const steps = [5_000, 25_000, 100_000]
    expect([0, 4_999, 5_000, 24_999, 99_999, 100_000, 1_000_000].map((count) => popularityOf(count, steps))).toEqual([
      'niche',
      'niche',
      'known',
      'known',
      'popular',
      'huge',
      'huge',
    ])
    expect(popularityOf(undefined, steps)).toBeNull()
  })

  it('keeps aliases that look like the same name and drops jokes and code names', () => {
    const facts = { alias: ['Rails', 'RoR', 'cute', '$', 'Ruby on Rails'], namePt: ['Ruby on Rails'] }
    expect(aliasesOf('Ruby on Rails', 'ruby-on-rails', facts)).toEqual(['ruby-on-rails', 'Rails', 'RoR'])
    expect(aliasesOf('Qt', 'qt', { alias: ['cute', 'Qt toolkit'] })).toEqual(['Qt toolkit'])
  })

  it('makes ids from our own seed names', () => {
    expect(idOf('Vue.js')).toBe('vue-js')
    expect(idOf('ASP.NET Core')).toBe('asp-net-core')
    expect(idOf('Microsoft SQL Server')).toBe('microsoft-sql-server')
  })

  it('names every missing or unknown trait', () => {
    expect(problemsOf({ name: 'X', language: 'javascript', area: [], kind: 'framework', maker: 'alien', license: 'mit', popularity: 'huge', year: 1800 }, 'frameworks', 2026)).toEqual([
      'no area',
      'unknown maker alien',
      'no year',
    ])
  })
})

describe('resolving seeds', () => {
  it('prefers a pinned id, then the Stack Overflow tag on the item, then the most linked item with the name', () => {
    const rows = [
      { tag: { value: 'https://stackoverflow.com/tags/reactjs' }, item: { value: 'http://www.wikidata.org/entity/Q1' }, sitelinks: { value: '3' } },
      { label: { value: 'React' }, item: { value: 'http://www.wikidata.org/entity/Q2' }, sitelinks: { value: '90' } },
      { label: { value: 'Unity' }, item: { value: 'http://www.wikidata.org/entity/Q3' }, sitelinks: { value: '10' } },
      { label: { value: 'Unity' }, item: { value: 'http://www.wikidata.org/entity/Q4' }, sitelinks: { value: '40' } },
    ]
    const seeds = [
      ['reactjs', 'React'],
      ['unity', 'Unity'],
      ['unity-game-engine', 'Unity', 'Q63966'],
      ['nothing', 'Nothing'],
    ]
    expect(resolveItems(seeds, rows)).toEqual({ reactjs: 'Q1', unity: 'Q4', 'unity-game-engine': 'Q63966' })
  })
})

describe('building a catalog from recorded answers', () => {
  it('normalizes frameworks, applies the overrides and drops what it cannot fill', () => {
    const { seeds, resolveRows, factRows, counts } = fixture('frameworks')
    const { items, dropped } = buildCatalog({ categoryId: 'frameworks', seeds, resolveRows, factRows, counts, overrides: FRAMEWORK_OVERRIDES, thisYear: 2026 })
    const byId = Object.fromEntries(items.map((item) => [item.id, item]))
    expect(Object.keys(byId)).toEqual(['django', 'express-js', 'flutter', 'qt', 'react'])
    expect(byId.react).toMatchObject({ name: 'React', language: 'javascript', area: ['frontend'], kind: 'library', maker: 'big-tech', license: 'mit', popularity: 'huge', year: 2013 })
    expect(byId.react.aliases).toContain('reactjs')
    expect(byId.django).toMatchObject({ language: 'python', area: ['backend'], maker: 'foundation', license: 'bsd', year: 2004 })
    // The data alone calls Express frontend and gives Flutter no area: the overrides fix both.
    expect(byId['express-js'].area).toEqual(['backend'])
    expect(byId.flutter).toMatchObject({ language: 'dart', area: ['mobile'], maker: 'big-tech' })
    // Qt has no English label in the answer: the seed's name stands in.
    expect(byId.qt).toMatchObject({ name: 'Qt', language: 'cpp', license: 'weak-copyleft' })
    expect(byId.react.questions).toBeGreaterThan(100_000)
    expect(byId.react.wikidata).toMatch(/^Q\d+$/)
    expect(dropped).toEqual([
      { tag: 'material-ui', reasons: ['too little data on Wikidata'] },
      { tag: 'alpine.js', reasons: ['not on Wikidata'] },
    ])
  })

  it('drops an item with a missing trait, saying which', () => {
    const { seeds, resolveRows, factRows, counts } = fixture('frameworks')
    const { items, dropped } = buildCatalog({ categoryId: 'frameworks', seeds, resolveRows, factRows, counts, overrides: {}, thisYear: 2026 })
    expect(items.map((item) => item.id)).not.toContain('flutter')
    expect(dropped).toContainEqual({ tag: 'flutter', reasons: ['no area'] })
  })

  it('normalizes databases: cloud services are proprietary and closed engines undisclosed', () => {
    const { seeds, resolveRows, factRows, counts } = fixture('databases')
    const { items } = buildCatalog({ categoryId: 'databases', seeds, resolveRows, factRows, counts, overrides: DATABASE_OVERRIDES, thisYear: 2026 })
    const byId = Object.fromEntries(items.map((item) => [item.id, item]))
    expect(byId.postgresql).toMatchObject({ model: ['relational'], query: 'sql', writtenIn: 'c', license: 'permissive', hosting: 'server', popularity: 'huge', year: 1996 })
    expect(byId.sqlite).toMatchObject({ hosting: 'embedded', license: 'permissive' })
    expect(byId.mongodb).toMatchObject({ model: ['document'], query: 'document-api', writtenIn: 'cpp', license: 'source-available' })
    expect(byId['amazon-dynamodb']).toMatchObject({ hosting: 'cloud', license: 'proprietary', writtenIn: 'undisclosed', model: ['key-value', 'document'] })
    expect(byId['microsoft-access']).toMatchObject({ writtenIn: 'undisclosed', hosting: 'embedded' })
    expect(byId.redis).toMatchObject({ model: ['key-value'], query: 'key-commands', license: 'gpl' })
  })
})

describe('the requests', () => {
  it('asks Wikidata for tags and names in one query, and for facts in another', () => {
    const resolve = buildResolveQuery([['reactjs', 'React']])
    expect(resolve).toContain('<https://stackoverflow.com/tags/reactjs>')
    expect(resolve).toContain('"React"@en')
    expect(resolve).toContain('wdt:P1482')
    const facts = buildFactsQuery(['Q1', 'Q2'])
    expect(facts).toContain('VALUES ?item { wd:Q1 wd:Q2 }')
    for (const property of ['P571', 'P577', 'P31', 'P366', 'P277', 'P275', 'P178']) expect(facts).toContain(property)
  })

  it('asks Stack Exchange for up to 100 tags at a time, with our user agent, and caches the answer', async () => {
    const fetch = vi.fn(async (url) => ({ ok: true, json: async () => ({ items: decodeURIComponent(url.split('/tags/')[1].split('/info')[0]).split(';').map((name) => ({ name, count: 1 })) }) }))
    vi.stubGlobal('fetch', fetch)
    const cacheDir = `${process.env.TEMP ?? '/tmp'}/glitchdle-sync-test-${crypto.randomUUID()}`
    const tags = Array.from({ length: 150 }, (_, index) => `tag${index}`)
    expect(await fetchTagCounts(tags, { cacheDir })).toHaveLength(150)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0][1].headers['User-Agent']).toBe(USER_AGENT)
    await fetchTagCounts(tags, { cacheDir })
    expect(fetch).toHaveBeenCalledTimes(2)
    await rm(cacheDir, { recursive: true, force: true })
  })
})

describe('the seeds', () => {
  it('has unique tags and enough of them for 40+ items per category', () => {
    for (const seeds of [FRAMEWORK_SEEDS, DATABASE_SEEDS]) {
      const tags = seeds.map(([tag]) => tag)
      expect(new Set(tags).size).toBe(tags.length)
      expect(seeds.length).toBeGreaterThanOrEqual(50)
    }
  })

  it('only overrides tags that are seeds, each with known fields', () => {
    for (const [seeds, overrides] of [
      [FRAMEWORK_SEEDS, FRAMEWORK_OVERRIDES],
      [DATABASE_SEEDS, DATABASE_OVERRIDES],
    ]) {
      const tags = new Set(seeds.map(([tag]) => tag))
      for (const tag of Object.keys(overrides)) expect(tags, tag).toContain(tag)
    }
  })
})
