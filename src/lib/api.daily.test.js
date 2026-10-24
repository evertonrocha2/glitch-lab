// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getDaily, getGlobalChallenge, getRiddle, guessRiddle, startPuzzle, switchPuzzleLanguage } from './api.js'
import { translateServerMessage } from './i18n/serverMessages.js'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

it("loads today's daily set", async () => {
  const body = { day: '2026-10-22', nextResetAt: '2026-10-23T03:00:00.000Z', streak: 1, puzzles: [] }
  fetch.mockResolvedValue(Response.json(body))
  await expect(getDaily('t1')).resolves.toEqual(body)
  expect(fetch.mock.calls[0][0]).toBe('/api/daily')
  expect(fetch.mock.calls[0][1].headers).toEqual({ 'Accept-Language': 'en', Authorization: 'Bearer t1' })
})

it("loads this week's global challenge", async () => {
  const body = { week: '2026-10-19', puzzle: { id: 'p1' }, solvedCount: 0, leaderboard: [], you: null }
  fetch.mockResolvedValue(Response.json(body))
  await expect(getGlobalChallenge('t1')).resolves.toEqual(body)
  expect(fetch.mock.calls[0][0]).toBe('/api/daily/weekly')
})

it('starts a puzzle and returns its challenge', async () => {
  fetch.mockResolvedValue(Response.json({ challenge: { id: 'ch9' } }, { status: 201 }))
  await expect(startPuzzle('p1', 't1')).resolves.toEqual({ id: 'ch9' })
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/daily/puzzles/p1/challenge')
  expect(init.method).toBe('POST')
  expect(init.body).toBeUndefined()
})

it('switches a puzzle to another language', async () => {
  const body = { puzzle: { id: 'p1', language: 'go' }, challenge: null, switchedFrom: 'python' }
  fetch.mockResolvedValue(Response.json(body))
  await expect(switchPuzzleLanguage('p1', 'go', 't1')).resolves.toEqual(body)
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/daily/puzzles/p1/switch')
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body)).toEqual({ language: 'go' })
})

it('translates why a switch was refused', async () => {
  const pt = (message) => translateServerMessage(message, 'pt-BR')
  expect(pt('You already switched the language of this challenge.')).toBe('Você já trocou a linguagem deste desafio.')
  expect(pt("You already solved this challenge, so its language can't change.")).toBe('Você já resolveu este desafio, então a linguagem dele não muda mais.')
  expect(pt('Pick one of the languages on the list.')).toBe('Escolha uma das linguagens da lista.')
  expect(pt('This challenge is already in that language.')).toBe('Este desafio já está nessa linguagem.')
  expect(pt("Couldn't make this challenge in C# right now. Your switch is still unused, so you can try again later.")).toBe(
    'Não deu para gerar este desafio em C# agora. Sua troca não foi usada, então dá para tentar de novo mais tarde.',
  )
})

it("loads today's Glitchdle and sends a guess", async () => {
  fetch.mockResolvedValueOnce(Response.json({ day: '2026-10-22', number: 1 }))
  await expect(getRiddle('t1')).resolves.toEqual({ day: '2026-10-22', number: 1 })
  expect(fetch.mock.calls[0][0]).toBe('/api/glitchdle')

  fetch.mockResolvedValueOnce(Response.json({ correct: true }))
  await expect(guessRiddle({ mode: 'classic', guess: 'rust', day: '2026-10-22' }, 't1')).resolves.toEqual({ correct: true })
  const [url, init] = fetch.mock.calls[1]
  expect(url).toBe('/api/glitchdle/guesses')
  expect(JSON.parse(init.body)).toEqual({ mode: 'classic', guess: 'rust', day: '2026-10-22' })
})
