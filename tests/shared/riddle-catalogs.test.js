// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CATEGORIES, categoryById, itemById, searchItems, SLOTS, valueLabel } from '../../shared/riddle/categories.js'
import { languageById } from '../../shared/riddle/languages.js'

const synced = CATEGORIES.filter((category) => category.id !== 'languages')

describe('the synced catalogs', () => {
  it('has 60+ items per category with unique ids and names', () => {
    for (const { id, items } of synced) {
      expect(items.length, id).toBeGreaterThanOrEqual(60)
      expect(new Set(items.map((item) => item.id)).size, id).toBe(items.length)
      expect(new Set(items.map((item) => item.name.toLowerCase())).size, id).toBe(items.length)
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
    expect(itemById('databases', 'mongodb')).toMatchObject({ model: ['document'] })
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
