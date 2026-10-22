import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import LanguageSelect from '../../components/LanguageSelect.jsx'
import { currentLocale, I18nProvider, initialLocale, translate, useT } from './I18nProvider.jsx'
import { MESSAGES } from './catalog.js'
import { timeAgoIn } from './format.js'
import { conceptName, levelTitle } from './labels.js'

beforeEach(() => localStorage.clear())

it('translates, fills in values, falls back to English, then to the key', () => {
  expect(translate('pt-BR', 'status.solved')).toBe('Resolvido')
  expect(translate('en', 'status.solved')).toBe('Solved')
  expect(translate('pt-BR', 'language.label')).toBe('Idioma')
  expect(translate('pt-BR', 'no.such.key')).toBe('no.such.key')
})

it('has a Portuguese entry for every English one', () => {
  const missing = Object.keys(MESSAGES.en).filter((key) => !(key in MESSAGES['pt-BR']))
  expect(missing).toEqual([])
})

it('names shared data in the chosen language', () => {
  const pt = (key, vars) => translate('pt-BR', key, vars)
  expect(conceptName(pt, 'off-by-one')).toBe('Erro de um a mais')
  expect(levelTitle(pt, 6)).toBe('Encantador de Bugs')
  expect(conceptName((key) => key, 'off-by-one')).toBe('Off by one')
})

it('starts in the browser language and remembers a choice', async () => {
  expect(initialLocale()).toBe('en')
  function Probe() {
    return <p>{useT()('status.new')}</p>
  }
  render(
    <I18nProvider>
      <LanguageSelect />
      <Probe />
    </I18nProvider>,
  )
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'pt-BR')
  expect(screen.getByText('Novo')).toBeInTheDocument()
  expect(currentLocale()).toBe('pt-BR')
  expect(document.documentElement.lang).toBe('pt-BR')
  expect(initialLocale()).toBe('pt-BR')
})

it('writes relative times in the chosen language', () => {
  const now = new Date('2026-10-22T12:00:00Z')
  expect(timeAgoIn('en', '2026-10-22T10:00:00Z', now)).toBe('2 hours ago')
  expect(timeAgoIn('pt-BR', '2026-10-22T10:00:00Z', now)).toBe('há 2 horas')
})

it('says zero in the plural in Portuguese, or with its own zero message', async () => {
  const { MESSAGES: catalog } = await import('./catalog.js')
  catalog['pt-BR']['test.likes'] = { one: '{count} curtida', other: '{count} curtidas' }
  catalog['pt-BR']['test.cases'] = { zero: 'Nenhum caso', one: '{count} caso', other: '{count} casos' }
  expect(translate('pt-BR', 'test.likes', { count: 0 })).toBe('0 curtidas')
  expect(translate('pt-BR', 'test.likes', { count: 1 })).toBe('1 curtida')
  expect(translate('pt-BR', 'test.cases', { count: 0 })).toBe('Nenhum caso')
  delete catalog['pt-BR']['test.likes']
  delete catalog['pt-BR']['test.cases']
})
