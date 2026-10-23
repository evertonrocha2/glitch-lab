// @vitest-environment node
import { expect, it } from 'vitest'
import { languageRule, localeOf } from '../../server/core/locale.js'

it('reads Portuguese from the Accept-Language header, English otherwise', () => {
  expect(localeOf('pt-BR')).toBe('pt-BR')
  expect(localeOf('pt')).toBe('pt-BR')
  expect(localeOf('en')).toBe('en')
  expect(localeOf('es-AR')).toBe('en')
  expect(localeOf(null)).toBe('en')
  expect(localeOf(undefined)).toBe('en')
})

it('tells the AI which language to write in', () => {
  expect(languageRule('pt-BR')).toMatch(/Brazilian Portuguese/)
  expect(languageRule('en')).toMatch(/English/)
})
