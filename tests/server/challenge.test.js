// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api, geminiAnswer, useTempStore } from './helpers.js'
import { CASE } from './store-contract.js'

const AI_CHALLENGE = {
  brokenCode: 'const order = {}\nconsole.log(order.items.length)',
  symptom: "TypeError: Cannot read properties of undefined (reading 'length')",
  hints: ['Which value is undefined here?', 'order.items was never set.', 'Give order an items array first.'],
  solution: 'const order = { items: [] }\nconsole.log(order.items.length)',
  bugExplanation: 'order.items is undefined, so it has no length.',
}

const start = (caseId, token) => api('/api/challenges', { body: { caseId }, token })
const read = (id, token) => api(`/api/challenges/${encodeURIComponent(id)}`, { method: 'GET', token })
const hint = (challengeId, token) => api(`/api/challenges/${encodeURIComponent(challengeId)}/hints`, { body: {}, token })

let store
let kase

beforeEach(async () => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key')
  vi.stubEnv('AI_RETRY_DELAY_MS', '0')
  vi.stubGlobal('fetch', vi.fn())
  store = await useTempStore()
  kase = await store.createCase('alice', CASE)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('asks for sign in without a user', async () => {
  expect((await start(kase.id, null)).status).toBe(401)
})

it('creates a challenge without leaking the solution or locked hints', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_CHALLENGE))
  const res = await start(kase.id)
  expect(res.status).toBe(201)
  const text = await res.text()
  expect(text).not.toContain(AI_CHALLENGE.solution)
  expect(text).not.toContain(AI_CHALLENGE.hints[0])
  expect(JSON.parse(text).challenge).toMatchObject({
    caseId: kase.id,
    brokenCode: AI_CHALLENGE.brokenCode,
    symptom: AI_CHALLENGE.symptom,
    language: 'javascript',
    hints: [],
    hintsRevealed: 0,
    hintsTotal: 3,
    status: 'open',
    attempts: 0,
  })
})

it('moves a new case to training', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_CHALLENGE))
  await start(kase.id)
  expect((await store.getCase('alice', kase.id)).status).toBe('training')
})

it('reuses the open challenge without calling the AI', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_CHALLENGE))
  const first = await (await start(kase.id)).json()
  const again = await start(kase.id)
  expect(again.status).toBe(200)
  expect((await again.json()).challenge.id).toBe(first.challenge.id)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('returns 502 and saves nothing when the AI challenge is incomplete', async () => {
  fetch.mockResolvedValue(geminiAnswer({ ...AI_CHALLENGE, hints: ['only', 'two'] }))
  const res = await start(kase.id)
  expect(res.status).toBe(502)
  expect(await store.findOpenChallenge('alice', kase.id)).toBeNull()
  expect((await store.getCase('alice', kase.id)).status).toBe('new')
})

it('keeps the first three hints when the AI sends more', async () => {
  fetch.mockResolvedValue(geminiAnswer({ ...AI_CHALLENGE, hints: [...AI_CHALLENGE.hints, 'a fourth hint'] }))
  const res = await start(kase.id)
  expect(res.status).toBe(201)
  const { challenge } = await res.json()
  expect(challenge.hintsTotal).toBe(3)
})

it('stops at the daily limit', async () => {
  for (let i = 0; i < 30; i++) await store.addUsage('alice', new Date().toISOString().slice(0, 10))
  const res = await start(kase.id)
  expect(res.status).toBe(429)
  expect(fetch).not.toHaveBeenCalled()
})

it("hides another user's case and challenge", async () => {
  const res = await start(kase.id, 'dev:bob')
  expect(res.status).toBe(404)
  expect(await res.json()).toEqual({ message: 'Case not found.' })

  fetch.mockResolvedValue(geminiAnswer(AI_CHALLENGE))
  const { challenge } = await (await start(kase.id)).json()
  const peek = await read(challenge.id, 'dev:bob')
  expect(peek.status).toBe(404)
  expect(await peek.json()).toEqual({ message: 'Challenge not found.' })
  expect((await hint(challenge.id, 'dev:bob')).status).toBe(404)
})

it('reveals hints one at a time, up to three', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_CHALLENGE))
  const { challenge } = await (await start(kase.id)).json()
  for (const [index, text] of AI_CHALLENGE.hints.entries()) {
    expect(await (await hint(challenge.id)).json()).toEqual({ hint: text, hintsRevealed: index + 1 })
  }
  const fourth = await hint(challenge.id)
  expect(fourth.status).toBe(409)
  expect(await fourth.json()).toEqual({ message: 'No more hints.' })
})

it('GET returns the challenge with the hints revealed so far', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_CHALLENGE))
  const { challenge } = await (await start(kase.id)).json()
  await hint(challenge.id)
  const res = await read(challenge.id)
  expect(res.status).toBe(200)
  expect((await res.json()).challenge).toMatchObject({ id: challenge.id, hints: [AI_CHALLENGE.hints[0]], hintsRevealed: 1 })
})

it('tells the gym which bug type the challenge trains', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_CHALLENGE))
  const created = await (await start(kase.id)).json()
  expect(created.challenge.concept).toBe('undefined-access')
  expect((await (await read(created.challenge.id)).json()).challenge.concept).toBe('undefined-access')
})

it('asks for hints and the bug explanation in Portuguese, with the symptom left as the real error', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_CHALLENGE))
  await api('/api/challenges', { body: { caseId: kase.id }, locale: 'pt-BR' })
  const sent = JSON.parse(fetch.mock.calls[0][1].body)
  const prompt = sent.contents[0].parts[0].text
  expect(sent.systemInstruction.parts[0].text).toMatch(/Brazilian Portuguese/)
  expect(prompt).toMatch(/Brazilian Portuguese/)
  expect(prompt).toMatch(/symptom is the real error message exactly as javascript prints it, never translated/)
})
