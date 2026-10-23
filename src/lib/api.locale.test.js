// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as api from './api.js'

// The reader's language as the API client sees it (the provider sets it in the app).
const reader = vi.hoisted(() => ({ locale: 'pt-BR' }))
vi.mock('./i18n/I18nProvider.jsx', async (original) => ({ ...(await original()), currentLocale: () => reader.locale }))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ case: {}, cases: [], challenge: {}, duel: {} }))))
})
afterEach(() => {
  vi.unstubAllGlobals()
  reader.locale = 'pt-BR'
})

// Every call whose answer has text the AI or the server writes for the reader.
const CALLS = {
  startDemo: () => api.startDemo('2026-10-22'),
  analyzeError: () => api.analyzeError({ error: 'TypeError: x' }, 't'),
  listCases: () => api.listCases('t'),
  startChallenge: () => api.startChallenge('c1', 't'),
  getChallenge: () => api.getChallenge('ch1', 't'),
  revealHint: () => api.revealHint('ch1', 't'),
  checkFix: () => api.checkFix('ch1', 'x', 't'),
  answerInterrogation: () => api.answerInterrogation({ caseId: 'c1', answer: 'a' }, 't'),
  getDaily: () => api.getDaily('t'),
  getGlobalChallenge: () => api.getGlobalChallenge('t'),
  startPuzzle: () => api.startPuzzle('p1', 't'),
  getHunt: () => api.getHunt('t'),
  getDuel: () => api.getDuel('d1', 't'),
  sendDuel: () => api.sendDuel('answer', { id: 'd1', round: 0, choice: 'x' }, 't'),
  buildTrail: () => api.buildTrail('2026-10-22', 't'),
  askAssistant: () => api.askAssistant({ messages: [{ role: 'user', content: 'oi' }], page: { path: '/board' } }, 't'),
  startReview: () => api.startReview('2026-10-22', 't'),
}

it.each(Object.keys(CALLS))('%s asks the server for the reader language', async (name) => {
  await CALLS[name]().catch(() => {})
  expect(fetch).toHaveBeenCalled()
  expect(fetch.mock.calls[0][1].headers['Accept-Language']).toBe('pt-BR')
})

it('follows a language switch on the next call', async () => {
  reader.locale = 'en'
  await api.getDaily('t')
  expect(fetch.mock.calls[0][1].headers['Accept-Language']).toBe('en')
})
