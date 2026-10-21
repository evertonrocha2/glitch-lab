import { beforeEach, describe, expect, it } from 'vitest'

// Every store (local file, Supabase) must pass these. Not a test file itself: suites import it.
export const CASE = {
  error: 'TypeError: x is undefined',
  code: 'x.y',
  analysis: { explicacao: 'a', causa: 'b', correcao: 'c', exercicio: { enunciado: 'd', resposta: 'e' } },
  concept: 'undefined-access',
  language: 'javascript',
}

export const challengeFor = (caseId) => ({
  caseId,
  brokenCode: 'const a = {}\nconsole.log(a.b.c)',
  symptom: "TypeError: Cannot read properties of undefined (reading 'c')",
  language: 'javascript',
  hints: ['Look at a.b', 'What is a.b right now?', 'Check a.b before reading .c'],
})

export const SECRET = { solution: 'console.log(a.b?.c)', bugExplanation: 'a.b is undefined' }

export function storeContract(label, makeStore, ids = { alice: 'alice', bob: 'bob' }) {
  describe(`${label} store`, () => {
    let store

    beforeEach(async () => {
      store = await makeStore()
    })

    it('creates a case as new with zero passes', async () => {
      const created = await store.createCase(ids.alice, CASE)
      expect(created).toMatchObject({ ...CASE, userId: ids.alice, status: 'new', passedCount: 0 })
      expect(created.id).toEqual(expect.any(String))
      expect(created.createdAt).toEqual(expect.any(String))
    })

    it("lists only the owner's cases, newest first", async () => {
      const first = await store.createCase(ids.alice, CASE)
      await store.createCase(ids.bob, CASE)
      const second = await store.createCase(ids.alice, { ...CASE, error: 'ReferenceError: y is not defined' })
      expect((await store.listCases(ids.alice)).map((item) => item.id)).toEqual([second.id, first.id])
    })

    it("hides another user's case", async () => {
      const created = await store.createCase(ids.alice, CASE)
      expect(await store.getCase(ids.bob, created.id)).toBeNull()
      expect(await store.updateCase(ids.bob, created.id, { status: 'solved' })).toBeNull()
      expect((await store.getCase(ids.alice, created.id)).status).toBe('new')
    })

    it('updates status and pass count', async () => {
      const created = await store.createCase(ids.alice, CASE)
      const updated = await store.updateCase(ids.alice, created.id, { status: 'training', passedCount: 1 })
      expect(updated).toMatchObject({ id: created.id, status: 'training', passedCount: 1 })
      expect(await store.getCase(ids.alice, created.id)).toMatchObject({ status: 'training', passedCount: 1 })
    })

    it('keeps the challenge secret apart', async () => {
      const kase = await store.createCase(ids.alice, CASE)
      const challenge = await store.createChallenge(ids.alice, challengeFor(kase.id), SECRET)
      expect(challenge).toMatchObject({ ...challengeFor(kase.id), userId: ids.alice, hintsRevealed: 0, status: 'open', attempts: 0 })
      expect(challenge).not.toHaveProperty('solution')
      expect(await store.getChallenge(ids.alice, challenge.id)).toEqual(challenge)
      expect(await store.getChallenge(ids.bob, challenge.id)).toBeNull()
      expect(await store.getChallengeSecret(challenge.id)).toEqual(SECRET)
    })

    it('finds the open challenge for a case', async () => {
      const kase = await store.createCase(ids.alice, CASE)
      const challenge = await store.createChallenge(ids.alice, challengeFor(kase.id), SECRET)
      expect((await store.findOpenChallenge(ids.alice, kase.id)).id).toBe(challenge.id)
      expect(await store.findOpenChallenge(ids.bob, kase.id)).toBeNull()
      await store.updateChallenge(ids.alice, challenge.id, { status: 'passed', attempts: 1, hintsRevealed: 2 })
      expect(await store.getChallenge(ids.alice, challenge.id)).toMatchObject({ status: 'passed', attempts: 1, hintsRevealed: 2 })
      expect(await store.findOpenChallenge(ids.alice, kase.id)).toBeNull()
    })

    it('creates a user and finds them by email in any case', async () => {
      const email = `Ada.${crypto.randomUUID()}@Example.com`
      const user = await store.createUser({ email, passwordHash: 'scrypt$aa$bb', isDemo: false })
      expect(user).toMatchObject({ email: email.toLowerCase(), passwordHash: 'scrypt$aa$bb', isDemo: false })
      expect(user.id).toEqual(expect.any(String))
      expect(await store.findUserByEmail(email.toUpperCase())).toEqual(user)
      expect(await store.findUserByEmail('nobody@example.com')).toBeNull()
    })

    it('refuses a second account with the same email', async () => {
      const email = `twice.${crypto.randomUUID()}@example.com`
      await store.createUser({ email, passwordHash: 'scrypt$aa$bb', isDemo: false })
      expect(await store.createUser({ email: email.toUpperCase(), passwordHash: 'scrypt$cc$dd', isDemo: false })).toBeNull()
    })

    it('counts usage per key per day', async () => {
      expect(await store.countUsage(ids.alice, '2026-10-21')).toBe(0)
      expect(await store.addUsage(ids.alice, '2026-10-21')).toBe(1)
      expect(await store.addUsage(ids.alice, '2026-10-21')).toBe(2)
      expect(await store.countUsage(ids.alice, '2026-10-22')).toBe(0)
      expect(await store.countUsage(ids.bob, '2026-10-21')).toBe(0)
    })
  })
}
