// @vitest-environment node
import { expect, it } from 'vitest'
import { languageRule, localeOf } from '../../server/core/locale.js'

const withLanguage = (value) => new Request('http://localhost/api/x', { headers: value ? { 'Accept-Language': value } : {} })

it('reads Portuguese from the Accept-Language header, English otherwise', () => {
  expect(localeOf(withLanguage('pt-BR'))).toBe('pt-BR')
  expect(localeOf(withLanguage('pt'))).toBe('pt-BR')
  expect(localeOf(withLanguage('en'))).toBe('en')
  expect(localeOf(withLanguage('es-AR'))).toBe('en')
  expect(localeOf(withLanguage(null))).toBe('en')
})

it('tells the AI which language to write in', () => {
  expect(languageRule('pt-BR')).toMatch(/Brazilian Portuguese/)
  expect(languageRule('en')).toMatch(/English/)
})
