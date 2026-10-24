// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { LANGUAGE_QUESTIONS } from '../../shared/riddle/catalogs/language-questions.js'
import { CATEGORIES, categoryById, itemById, searchItems, SLOTS, valueLabel } from '../../shared/riddle/categories.js'
import { LANGUAGES, languageById } from '../../shared/riddle/languages.js'

const synced = CATEGORIES.filter((category) => category.id !== 'languages')

describe('the synced catalogs', () => {
  it('has 60+ items per category with unique ids and names', () => {
    for (const { id, items } of synced) {
      expect(items.length, id).toBeGreaterThanOrEqual(60)
      expect(new Set(items.map((item) => item.id)).size, id).toBe(items.length)
      expect(new Set(items.map((item) => item.name.toLowerCase())).size, id).toBe(items.length)
    }
  })

  it('has a raw count behind every ranked bucket', () => {
    for (const { id, items } of synced) {
      for (const item of items) {
        expect(Number.isInteger(item.questions), `${id} ${item.id} questions`).toBe(true)
        expect(Number.isInteger(item.sitelinks), `${id} ${item.id} sitelinks`).toBe(true)
      }
    }
  })

  it('fills every trait with a known value', () => {
    for (const { id, items, attributes } of synced) {
      for (const item of items) {
        for (const { key, kind, values } of attributes) {
          const value = item[key]
          const known = (entry) => (values === 'languages' ? Boolean(languageById(entry)) || entry === 'undisclosed' : values.includes(entry))
          if (kind === 'year') expect(Number.isInteger(value) && value >= 1970 && value <= 2026, `${id} ${item.id} ${key}`).toBe(true)
          else if (kind === 'set') expect(value.length > 0 && value.every(known), `${id} ${item.id} ${key}`).toBe(true)
          else expect(known(value), `${id} ${item.id} ${key} ${value}`).toBe(true)
        }
        expect(Array.isArray(item.aliases), item.id).toBe(true)
        expect(item.wikidata, item.id).toMatch(/^Q\d+$/)
      }
    }
  })

  it('labels every value a cell can show', () => {
    for (const { id, items, attributes, labels } of synced) {
      for (const item of items) {
        for (const { key, kind } of attributes) {
          if (kind === 'year') continue
          for (const value of [item[key]].flat()) expect(labels[value] ?? languageById(value)?.name, `${id} ${value}`).toEqual(expect.any(String))
        }
      }
    }
    expect(valueLabel('databases', 'undisclosed')).toBe('Not public')
    expect(valueLabel('frameworks', 'javascript')).toBe('JavaScript')
    expect(valueLabel('databases', 'cpp')).toBe('C++')
    expect(valueLabel('databases', 'key-value')).toBe('Key-value')
  })

  it('knows a few well-known items', () => {
    expect(itemById('frameworks', 'react')).toMatchObject({ language: 'javascript', area: ['frontend'] })
    expect(itemById('frameworks', 'django')).toMatchObject({ language: 'python', area: ['backend'] })
    expect(itemById('databases', 'postgresql')).toMatchObject({ model: ['relational'], query: 'sql', writtenIn: 'c' })
    expect(itemById('databases', 'mongodb')).toMatchObject({ model: ['document'], acid: 'full', maker: 'company' })
    expect(itemById('databases', 'redis')).toMatchObject({ acid: 'partial', storage: 'memory' })
    expect(itemById('databases', 'elasticsearch')).toMatchObject({ acid: 'none', storage: 'disk' })
    expect(itemById('frameworks', 'spring-boot')).toMatchObject({ runtime: 'jvm', typing: 'static' })
    expect(itemById('frameworks', 'angular')).toMatchObject({ runtime: 'js-engine', typing: 'gradual' })
  })
})

describe('the languages', () => {
  const { attributes, labels } = categoryById('languages')

  it('fills every new trait for every language, with a label for each value', () => {
    for (const item of LANGUAGES) {
      for (const { key, kind, values } of attributes) {
        if (kind === 'year') continue
        for (const value of [item[key]].flat()) {
          expect(value, `${item.id} ${key}`).toEqual(expect.any(String))
          if (values) expect(values, `${item.id} ${key}`).toContain(value)
          expect(labels[value], `${item.id} ${key} ${value}`).toEqual(expect.any(String))
        }
      }
    }
  })

  it('has a Stack Overflow count behind every popularity bucket', () => {
    expect(Object.keys(LANGUAGE_QUESTIONS).sort()).toEqual(LANGUAGES.map((item) => item.id).sort())
    for (const count of Object.values(LANGUAGE_QUESTIONS)) expect(count).toBeGreaterThan(0)
    // Every bucket gets a fair share of the languages.
    for (const bucket of ['niche', 'known', 'popular', 'huge']) expect(LANGUAGES.filter((item) => item.popularity === bucket).length, bucket).toBeGreaterThanOrEqual(4)
  })

  it('knows a few well-known values', () => {
    expect(languageById('java')).toMatchObject({ runtime: 'jvm', indentation: 'no', standard: 'no', popularity: 'huge' })
    expect(languageById('python')).toMatchObject({ runtime: 'interpreter', indentation: 'yes' })
    expect(languageById('c')).toMatchObject({ runtime: 'native', standard: 'yes' })
    expect(languageById('sql')).toMatchObject({ runtime: 'database', standard: 'yes' })
    expect(languageById('elixir')).toMatchObject({ runtime: 'own-runtime', popularity: 'niche' })
  })
})

describe('slots and search', () => {
  it('has the three language modes and one slot per other category', () => {
    expect(SLOTS).toEqual(['classic', 'error', 'snippet', 'frameworks', 'databases'])
    expect(categoryById('frameworks').modes).toEqual(['frameworks'])
  })

  it('finds items by name, alias or tag, ignoring accents and case', () => {
    const frameworks = categoryById('frameworks').items
    expect(searchItems('rails', frameworks)[0].id).toBe('ruby-on-rails')
    expect(searchItems('reactjs', frameworks)[0].id).toBe('react')
    expect(searchItems('VUE', frameworks)[0].id).toBe('vue-js')
    const databases = categoryById('databases').items
    expect(searchItems('postgrés', databases)[0].id).toBe('postgresql')
    expect(searchItems('mongo', databases)[0].id).toBe('mongodb')
  })
})
