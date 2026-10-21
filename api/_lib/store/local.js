import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const emptyDb = () => ({ users: [], cases: [], challenges: [], secrets: {}, usage: {} })
const now = () => new Date().toISOString()
// Hand out copies so callers can't edit the store by accident.
const copy = (value) => (value == null ? null : structuredClone(value))

// Development only: the whole database is one JSON file (default .data/db.json).
export function createLocalStore({ file }) {
  let loading
  let writing = Promise.resolve()

  // One shared load: two first requests must end up with the same db object, or one write is lost.
  function load() {
    loading ??= readFile(file, 'utf8').then(JSON.parse, () => emptyDb())
    return loading
  }

  // Writes queue up so two requests never write the file at the same time.
  function save() {
    writing = writing.then(async () => {
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, JSON.stringify(await loading, null, 2))
    })
    return writing
  }

  const ownCase = (data, userId, id) => data.cases.find((item) => item.id === id && item.userId === userId)
  const ownChallenge = (data, userId, id) => data.challenges.find((item) => item.id === id && item.userId === userId)

  return {
    // Emails are stored lowercase, so "Ada@X.com" and "ada@x.com" are the same account. null when taken.
    async createUser({ email, passwordHash, isDemo }) {
      const data = await load()
      data.users ??= []
      const normalized = email.trim().toLowerCase()
      if (data.users.some((user) => user.email === normalized)) return null
      const created = { id: randomUUID(), email: normalized, passwordHash, isDemo: Boolean(isDemo), createdAt: now() }
      data.users.push(created)
      await save()
      return copy(created)
    },

    async findUserByEmail(email) {
      const data = await load()
      const normalized = email.trim().toLowerCase()
      return copy((data.users ?? []).find((user) => user.email === normalized))
    },

    async createCase(userId, { error, code, analysis, concept, language }) {
      const data = await load()
      const stamp = now()
      const created = { id: randomUUID(), userId, error, code, analysis, concept, language, status: 'new', passedCount: 0, createdAt: stamp, updatedAt: stamp }
      data.cases.push(created)
      await save()
      return copy(created)
    },

    async listCases(userId) {
      const data = await load()
      return copy(data.cases.filter((item) => item.userId === userId).reverse())
    },

    async getCase(userId, id) {
      return copy(ownCase(await load(), userId, id))
    },

    async updateCase(userId, id, { status, passedCount }) {
      const found = ownCase(await load(), userId, id)
      if (!found) return null
      if (status !== undefined) found.status = status
      if (passedCount !== undefined) found.passedCount = passedCount
      found.updatedAt = now()
      await save()
      return copy(found)
    },

    async createChallenge(userId, { caseId, brokenCode, symptom, language, hints }, { solution, bugExplanation }) {
      const data = await load()
      const created = { id: randomUUID(), caseId, userId, brokenCode, symptom, language, hints, hintsRevealed: 0, status: 'open', attempts: 0, createdAt: now() }
      data.challenges.push(created)
      data.secrets[created.id] = { solution, bugExplanation }
      await save()
      return copy(created)
    },

    async getChallenge(userId, id) {
      return copy(ownChallenge(await load(), userId, id))
    },

    async findOpenChallenge(userId, caseId) {
      const data = await load()
      return copy(data.challenges.find((item) => item.userId === userId && item.caseId === caseId && item.status === 'open'))
    },

    async updateChallenge(userId, id, { hintsRevealed, status, attempts }) {
      const found = ownChallenge(await load(), userId, id)
      if (!found) return null
      if (hintsRevealed !== undefined) found.hintsRevealed = hintsRevealed
      if (status !== undefined) found.status = status
      if (attempts !== undefined) found.attempts = attempts
      await save()
      return copy(found)
    },

    async getChallengeSecret(challengeId) {
      return copy((await load()).secrets[challengeId])
    },

    async countUsage(key, day) {
      return (await load()).usage[`${key}:${day}`] ?? 0
    },

    async addUsage(key, day) {
      const data = await load()
      const slot = `${key}:${day}`
      data.usage[slot] = (data.usage[slot] ?? 0) + 1
      await save()
      return data.usage[slot]
    },
  }
}
