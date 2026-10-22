import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const emptyDb = () => ({ users: [], cases: [], challenges: [], secrets: {}, usage: {}, notes: [], study: {} })
const now = () => new Date().toISOString()
// Hand out copies so callers can't edit the store by accident.
const copy = (value) => (value == null ? null : structuredClone(value))

// Profile fields sit on the user; accounts made before profiles existed simply don't have them yet.
const PROFILE_FIELDS = ['handle', 'displayName', 'bio', 'avatar', 'featuredBadges', 'isPublic']
// "About you" fields, added later still: same story.
const ABOUT_FIELDS = ['role', 'headline', 'university', 'course', 'work', 'location', 'languages', 'links', 'openTo']
const toProfile = (user) =>
  copy({
    handle: user.handle ?? null,
    displayName: user.displayName ?? null,
    bio: user.bio ?? '',
    avatar: user.avatar ?? null,
    featuredBadges: user.featuredBadges ?? [],
    isPublic: user.isPublic ?? false,
    role: user.role ?? null,
    headline: user.headline ?? '',
    university: user.university ?? '',
    course: user.course ?? '',
    work: user.work ?? '',
    location: user.location ?? '',
    languages: user.languages ?? [],
    links: user.links ?? {},
    openTo: user.openTo ?? [],
    createdAt: user.createdAt,
  })
// Notes made before sharing existed are private.
const toNote = (note) => copy({ ...note, isPublic: note.isPublic ?? false })

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
  // Files saved before notes and study time existed don't have these lists yet.
  const notesOf = (data) => (data.notes ??= [])
  const studyOf = (data) => (data.study ??= {})

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

    async createCase(userId, { error, code, analysis, concept, language, files = [], context = '' }) {
      const data = await load()
      const stamp = now()
      const created = { id: randomUUID(), userId, error, code, files, context, analysis, concept, language, status: 'new', passedCount: 0, createdAt: stamp, updatedAt: stamp }
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

    async listChallenges(userId) {
      const data = await load()
      return copy(data.challenges.filter((item) => item.userId === userId))
    },

    async getChallengeSecret(challengeId) {
      return copy((await load()).secrets[challengeId])
    },

    async createNote(userId, { title, blocks, isPublic = false }) {
      const data = await load()
      const stamp = now()
      const created = { id: randomUUID(), userId, title, blocks, isPublic, createdAt: stamp, updatedAt: stamp }
      notesOf(data).push(created)
      await save()
      return toNote(created)
    },

    // Most recently edited first.
    async listNotes(userId) {
      const data = await load()
      return notesOf(data)
        .filter((note) => note.userId === userId)
        .reverse()
        .map(toNote)
    },

    async getNote(userId, id) {
      const data = await load()
      const found = notesOf(data).find((note) => note.id === id && note.userId === userId)
      return found ? toNote(found) : null
    },

    async updateNote(userId, id, { title, blocks, isPublic }) {
      const notes = notesOf(await load())
      const index = notes.findIndex((note) => note.id === id && note.userId === userId)
      if (index === -1) return null
      const [found] = notes.splice(index, 1)
      if (title !== undefined) found.title = title
      if (blocks !== undefined) found.blocks = blocks
      if (isPublic !== undefined) found.isPublic = isPublic
      found.updatedAt = now()
      // Kept in edit order, so the list stays "last edited first".
      notes.push(found)
      await save()
      return toNote(found)
    },

    async deleteNote(userId, id) {
      const notes = notesOf(await load())
      const index = notes.findIndex((note) => note.id === id && note.userId === userId)
      if (index === -1) return false
      notes.splice(index, 1)
      await save()
      return true
    },

    // Returns the new total for that day, never above maxPerDay.
    async addStudyTime(userId, day, seconds, maxPerDay) {
      const study = studyOf(await load())
      const slot = `${userId}:${day}`
      study[slot] = Math.min((study[slot] ?? 0) + seconds, maxPerDay)
      await save()
      return study[slot]
    },

    async listStudyTime(userId) {
      const study = studyOf(await load())
      const prefix = `${userId}:`
      return Object.entries(study)
        .filter(([slot]) => slot.startsWith(prefix))
        .map(([slot, seconds]) => ({ day: slot.slice(prefix.length), seconds }))
        .sort((a, b) => a.day.localeCompare(b.day))
    },

    async getProfile(userId) {
      const found = (await load()).users?.find((user) => user.id === userId)
      return found ? toProfile(found) : null
    },

    // { profile }, { conflict: 'handle' } when another account has that handle, or null for no such user.
    async updateProfile(userId, patch) {
      const users = (await load()).users ?? []
      const found = users.find((user) => user.id === userId)
      if (!found) return null
      const handle = typeof patch.handle === 'string' ? patch.handle.toLowerCase() : patch.handle
      if (handle && users.some((user) => user.id !== userId && user.handle === handle)) return { conflict: 'handle' }
      for (const field of [...PROFILE_FIELDS, ...ABOUT_FIELDS]) {
        if (patch[field] !== undefined) found[field] = field === 'handle' ? handle : structuredClone(patch[field])
      }
      await save()
      return { profile: toProfile(found) }
    },

    async findPublicProfile(handle) {
      const normalized = handle.toLowerCase()
      const found = (await load()).users?.find((user) => user.handle === normalized && user.isPublic)
      return found ? { userId: found.id, profile: toProfile(found) } : null
    },

    // Public profiles whose handle or name holds the query (any case), newest members first.
    // An empty query lists the newest ones.
    async searchPublicProfiles(query, limit) {
      const needle = query.toLowerCase()
      return ((await load()).users ?? [])
        .filter((user) => user.isPublic && user.handle)
        .filter((user) => [user.handle, user.displayName ?? ''].some((value) => value.toLowerCase().includes(needle)))
        .reverse()
        .slice(0, limit)
        .map((user) => ({ userId: user.id, profile: toProfile(user) }))
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
