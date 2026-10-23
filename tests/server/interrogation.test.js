// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DAILY_AI_LIMIT } from '../../server/infra/ai/quota.js'
import { INTERROGATION_STEPS, INTERROGATION_XP } from '../../shared/interrogation.js'
import { api, geminiAnswer, useTempStore } from './helpers.js'

const URL_ = (caseId) => `/api/cases/${encodeURIComponent(caseId)}/interrogation`
const answer = (caseId, text, opts = {}) => api(`${URL_(caseId)}/answers`, { body: { answer: text }, ...opts })
const load = (caseId, token) => api(URL_(caseId), { method: 'GET', token })
const sentPrompt = (call = 0) => JSON.parse(fetch.mock.calls[call][1].body)
const today = () => new Date().toISOString().slice(0, 10)

const CASE = {
  error: "TypeError: Cannot read properties of undefined (reading 'length')",
  code: 'const user = {}\nconsole.log(user.name.length)',
  analysis: {
    explicacao: 'You read .length of something missing.',
    causa: 'user.name is undefined.',
    correcao: 'Check first:\nif (user.name) console.log(user.name.length)',
    exercicio: { enunciado: 'x', resposta: 'y' },
  },
  concept: 'undefined-access',
  language: 'javascript',
}

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

it('asks for sign in', async () => {
  expect((await load(kase.id, null)).status).toBe(401)
  expect((await answer(kase.id, 'x', { token: null })).status).toBe(401)
})

it('opens a fresh interrogation with the case', async () => {
  const res = await load(kase.id)
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body.case).toMatchObject({ id: kase.id, error: CASE.error })
  expect(body.interrogation).toMatchObject({ caseId: kase.id, step: 0, turns: [], finished: false, steps: INTERROGATION_STEPS, xp: INTERROGATION_XP })
})

it("never shows someone else's case", async () => {
  expect((await load(kase.id, 'dev:bob')).status).toBe(404)
  expect((await answer(kase.id, 'calling it', { token: 'dev:bob' })).status).toBe(404)
  expect(fetch).not.toHaveBeenCalled()
})

it('turns away empty, too long and malformed answers without an AI call', async () => {
  expect((await answer(kase.id, '   ')).status).toBe(400)
  expect((await answer(kase.id, 'x'.repeat(1201))).status).toBe(413)
  expect((await api(`${URL_('x'.repeat(65))}/answers`, { body: { answer: 'x' } })).status).toBe(400)
  expect((await api(`${URL_(kase.id)}/answers`, { body: { answer: 7 } })).status).toBe(400)
  expect((await load('x'.repeat(65))).status).toBe(400)
  expect(fetch).not.toHaveBeenCalled()
})

it('keeps the step when the coach says not yet, with one guiding question', async () => {
  fetch.mockResolvedValue(geminiAnswer({ passed: false, feedback: 'Too vague.', question: 'What input did you use?' }))
  const res = await answer(kase.id, 'it breaks')
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body.turn).toMatchObject({ step: 'reproduce', passed: false, feedback: 'Too vague.', question: 'What input did you use?' })
  expect(body.interrogation.step).toBe(0)
  expect(body).toMatchObject({ finished: false, xp: 0 })
  expect(await store.countUsage('alice', today())).toBe(1)
  // The coach sees the case, the step and the answer as data.
  const sent = sentPrompt()
  const prompt = sent.contents[0].parts[0].text
  expect(prompt).toContain(CASE.error)
  expect(prompt).toContain('CURRENT STEP (1 of 6): Reproduce')
  expect(prompt).toContain('<student_answer>\nit breaks\n</student_answer>')
  expect(sent.systemInstruction.parts[0].text).toMatch(/never write the fixed code/)
})

it('writes the feedback in Portuguese for a Portuguese reader', async () => {
  fetch.mockResolvedValue(geminiAnswer({ passed: true, feedback: 'Boa.', question: '' }))
  await answer(kase.id, 'chamando com user vazio', { locale: 'pt-BR' })
  expect(sentPrompt().systemInstruction.parts[0].text).toContain('Brazilian Portuguese')
  expect(sentPrompt().contents[0].parts[0].text).toMatch(/Language of feedback and question: Write every explanation, hint, feedback and title in Brazilian Portuguese/)
})

it('keeps the coach in English for an English reader', async () => {
  fetch.mockResolvedValue(geminiAnswer({ passed: true, feedback: 'Good.', question: '' }))
  await answer(kase.id, 'calling it with an empty user')
  expect(sentPrompt().systemInstruction.parts[0].text).not.toContain('Portuguese')
  expect(sentPrompt().contents[0].parts[0].text).toMatch(/Language of feedback and question: Write in plain, simple English/)
})

it('hides a reply that gives the fix away before step 5', async () => {
  fetch.mockResolvedValue(
    geminiAnswer({ passed: false, feedback: 'Just write if (user.name) console.log(user.name.length).', question: 'if (user.name) console.log(user.name.length)?' }),
  )
  const body = await (await answer(kase.id, 'I run the file')).json()
  expect(body.turn.feedback).not.toContain('if (user.name)')
  expect(body.turn.question).not.toContain('if (user.name)')
  expect(body.turn.question).toBe('What exact input or action makes the error show up?')
  const saved = await store.getInterrogation('alice', kase.id)
  expect(JSON.stringify(saved)).not.toContain('if (user.name) console')
})

it('walks all six steps, finishes once, and pays XP and the badge', async () => {
  fetch.mockImplementation(async () => geminiAnswer({ passed: true, feedback: 'Yes: if (user.name) console.log(user.name.length) is it.', question: '' }))
  const before = (await (await api('/api/progress', { method: 'GET' })).json()).progress
  let body
  for (const [index] of INTERROGATION_STEPS.entries()) {
    body = await (await answer(kase.id, `answer ${index + 1}`)).json()
    expect(body.interrogation.step).toBe(index + 1)
  }
  expect(body).toMatchObject({ finished: true, xp: INTERROGATION_XP })
  expect(body.interrogation.completedAt).toEqual(expect.any(String))
  // From the fix step on, the coach may talk about the fix.
  expect(body.turn.feedback).toContain('if (user.name)')

  const again = await answer(kase.id, 'one more')
  expect(again.status).toBe(409)
  expect(fetch).toHaveBeenCalledTimes(6)

  const after = (await (await api('/api/progress', { method: 'GET' })).json()).progress
  expect(after.xp - before.xp).toBe(INTERROGATION_XP)
  expect(after.badges.find((badge) => badge.id === 'scientific-method').earned).toBe(true)
  expect(before.badges.find((badge) => badge.id === 'scientific-method').earned).toBe(false)
})

it('stops at the daily AI limit', async () => {
  for (let i = 0; i < DAILY_AI_LIMIT.user; i++) await store.addUsage('alice', today())
  expect((await answer(kase.id, 'calling it')).status).toBe(429)
  expect(fetch).not.toHaveBeenCalled()
})

it('reports an AI failure without saving anything', async () => {
  fetch.mockResolvedValue(geminiAnswer({ nope: true }))
  expect((await answer(kase.id, 'calling it')).status).toBe(502)
  expect(await store.getInterrogation('alice', kase.id)).toBeNull()
})

it('refuses an answer that lost a race with another one', async () => {
  fetch.mockImplementation(async () => {
    // Another tab saves an answer while the AI is thinking.
    await store.saveInterrogation('alice', kase.id, { step: 0, turns: [{ step: 'reproduce', answer: 'x', feedback: 'y', question: 'z', passed: false, at: '2026-10-23T00:00:00Z' }] }, 0)
    return geminiAnswer({ passed: true, feedback: 'Good.', question: '' })
  })
  expect((await answer(kase.id, 'calling it')).status).toBe(409)
})

it('still hands out hints on their own route', async () => {
  expect((await api('/api/challenges/nope/hints', { body: {} })).status).toBe(404)
  const wrongMethod = await api('/api/challenges/nope/hints', { method: 'GET' })
  expect(wrongMethod.status).toBe(404)
  expect(await wrongMethod.json()).toEqual({ message: 'Not found.' })
})
