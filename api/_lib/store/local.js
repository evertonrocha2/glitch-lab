import { randomUUID } from 'node:crypto'
import { profileFromUser } from './profileShape.js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createLocalCommunity } from './community-local.js'
import { createLocalDuels } from './duel-local.js'
import { createLocalEvents } from './events-local.js'
import { createLocalHunt } from './hunt-local.js'
import { createLocalReview } from './review-local.js'
import { createLocalInterrogations } from './interrogation-local.js'

const emptyDb = () => ({ users: [], cases: [], challenges: [], secrets: {}, usage: {}, notes: [], study: {} })
const now = () => new Date().toISOString()
// Hand out copies so callers can't edit the store by accident.
const copy = (value) => (value == null ? null : structuredClone(value))

// Profile fields sit on the user; accounts made before profiles existed simply don't have them yet.
const PROFILE_FIELDS = ['handle', 'displayName', 'bio', 'avatar', 'featuredBadges', 'isPublic']
// "About you" fields, added later still: same story.
const ABOUT_FIELDS = ['role', 'headline', 'university', 'course', 'work', 'location', 'languages', 'links', 'openTo']
const toProfile = profileFromUser
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
  // Daily and global puzzles came later too; their secrets sit apart like challenge secrets.
  const puzzlesOf = (data) => (data.puzzles ??= [])
  const puzzleSecretsOf = (data) => (data.puzzleSecrets ??= {})
  // Glitchdle: one riddle per day and mode, and one result per player, day and mode.
  const riddlesOf = (data) => (data.riddles ??= [])
  const riddleResultsOf = (data) => (data.riddleResults ??= [])
  const ownResult = (data, userId, day, mode) => riddleResultsOf(data).find((item) => item.userId === userId && item.day === day && item.mode === mode)

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

    // A gym challenge has a caseId; a daily or global one has a puzzleId instead, and only one per user
    // per puzzle (null when it already exists).
    async createChallenge(userId, { caseId = null, puzzleId = null, brokenCode, symptom, language, hints }, { solution, bugExplanation }) {
      const data = await load()
      if (puzzleId && data.challenges.some((item) => item.userId === userId && item.puzzleId === puzzleId)) return null
      const created = { id: randomUUID(), caseId, puzzleId, userId, brokenCode, symptom, language, hints, hintsRevealed: 0, status: 'open', attempts: 0, passedAt: null, createdAt: now() }
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
      // The first pass is the one the leaderboard times.
      if (status === 'passed' && !found.passedAt) found.passedAt = now()
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

    // One puzzle per slot (kind, day, difficulty): null when the slot is already taken.
    async createPuzzle({ kind, day, difficulty, language, concept, title, brokenCode, symptom, hints }, { solution, bugExplanation }) {
      const data = await load()
      const puzzles = puzzlesOf(data)
      if (puzzles.some((item) => item.kind === kind && item.day === day && item.difficulty === difficulty)) return null
      const created = { id: randomUUID(), kind, day, difficulty, language, concept, title, brokenCode, symptom, hints, createdAt: now() }
      puzzles.push(created)
      puzzleSecretsOf(data)[created.id] = { solution, bugExplanation }
      await save()
      return copy(created)
    },

    // Every filter is optional: kind, day (exact), since (that day or later), ids.
    async listPuzzles({ kind, day, since, ids } = {}) {
      const puzzles = puzzlesOf(await load()).filter(
        (item) =>
          (kind === undefined || item.kind === kind) &&
          (day === undefined || item.day === day) &&
          (since === undefined || item.day >= since) &&
          (ids === undefined || ids.includes(item.id)),
      )
      return copy(puzzles.sort((a, b) => a.day.localeCompare(b.day)))
    },

    async getPuzzle(id) {
      return copy(puzzlesOf(await load()).find((item) => item.id === id))
    },

    async getPuzzleSecret(puzzleId) {
      return copy(puzzleSecretsOf(await load())[puzzleId])
    },

    async findPuzzleChallenge(userId, puzzleId) {
      return copy((await load()).challenges.find((item) => item.userId === userId && item.puzzleId === puzzleId))
    },

    // Who passed a puzzle: [{ userId, attempts, startedAt, passedAt }], first pass first.
    async puzzleSolves(puzzleId) {
      const data = await load()
      // Demo accounts are free and unlimited: they play, but never rank.
      const demos = new Set((data.users ?? []).filter((user) => user.isDemo).map((user) => user.id))
      return data.challenges
        .filter((item) => item.puzzleId === puzzleId && item.status === 'passed' && item.passedAt && !demos.has(item.userId))
        .map((item) => ({ userId: item.userId, attempts: item.attempts, startedAt: item.createdAt, passedAt: item.passedAt }))
        .sort((a, b) => a.passedAt.localeCompare(b.passedAt))
    },

    // Glitchdle. One riddle per (day, mode): null when that slot is already taken. The answer stays
    // on the server; the API decides what a player may see.
    async createRiddle({ day, mode, answer, payload = {}, source = 'dataset' }) {
      const data = await load()
      const riddles = riddlesOf(data)
      if (riddles.some((item) => item.day === day && item.mode === mode)) return null
      const created = { id: randomUUID(), day, mode, answer, payload, source, createdAt: now() }
      riddles.push(created)
      await save()
      return copy(created)
    },

    // Filters are optional: day (exact) or since (that day or later). Oldest day first.
    async listRiddles({ day, since } = {}) {
      const riddles = riddlesOf(await load()).filter((item) => (day === undefined || item.day === day) && (since === undefined || item.day >= since))
      return copy(riddles.sort((a, b) => a.day.localeCompare(b.day)))
    },

    async getRiddleResult(userId, day, mode) {
      return copy(ownResult(await load(), userId, day, mode))
    },

    // Writes my guesses for a day and mode. expectedCount is how many guesses I had when I read
    // them: if another request saved in between, nothing is written and the answer is null.
    async saveRiddleResult(userId, { day, mode, guesses, solved }, expectedCount) {
      const data = await load()
      const found = ownResult(data, userId, day, mode)
      if ((found?.guesses.length ?? 0) !== expectedCount) return null
      const stamp = now()
      const result = found ?? { userId, day, mode, guesses: [], solved: false, solvedAt: null }
      result.guesses = [...guesses]
      result.solved = Boolean(solved)
      if (result.solved && !result.solvedAt) result.solvedAt = stamp
      result.updatedAt = stamp
      if (!found) riddleResultsOf(data).push(result)
      await save()
      return copy(result)
    },

    async listRiddleResults(userId) {
      const results = riddleResultsOf(await load()).filter((item) => item.userId === userId)
      return copy(results.sort((a, b) => a.day.localeCompare(b.day)))
    },

    // Everyone's results for a day, for the community numbers: [{ userId, mode, guessCount, solved }].
    // Demo accounts play but don't count, like on the leaderboard.
    async riddleDayResults(day) {
      const data = await load()
      const demos = new Set((data.users ?? []).filter((user) => user.isDemo).map((user) => user.id))
      return riddleResultsOf(data)
        .filter((item) => item.day === day && !demos.has(item.userId))
        .map((item) => ({ userId: item.userId, mode: item.mode, guessCount: item.guesses.length, solved: item.solved }))
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

    // Study trails. createdAt may be given (the demo's trail starts in the past); files saved before
    // trails existed don't have the list yet.
    async createTrail(userId, { title, summary, missions, done = [], createdAt }) {
      const data = await load()
      const created = { id: randomUUID(), userId, title, summary, missions, done, createdAt: createdAt ?? now() }
      data.trails ??= []
      data.trails.push(created)
      await save()
      return copy(created)
    },

    // Newest first; for the same start time, the one made last.
    async listTrails(userId) {
      const trails = (await load()).trails ?? []
      return copy(
        trails
          .filter((trail) => trail.userId === userId)
          .reverse()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      )
    },

    async getTrail(userId, id) {
      return copy(((await load()).trails ?? []).find((trail) => trail.id === id && trail.userId === userId))
    },

    // null when the trail isn't mine or has no such mission.
    async setMissionDone(userId, trailId, missionId, done) {
      const found = ((await load()).trails ?? []).find((trail) => trail.id === trailId && trail.userId === userId)
      if (!found?.missions.some((mission) => mission.id === missionId)) return null
      const others = found.done.filter((id) => id !== missionId)
      found.done = done ? [...others, missionId] : others
      await save()
      return copy(found)
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

    // Articles, comments, reactions and notifications: see community-local.js.
    ...createLocalCommunity({ load, save }),

    // Duels and duel ratings: see duel-local.js.
    ...createLocalDuels({ load, save }),
    // Community events, entries and votes: see events-local.js.
    ...createLocalEvents({ load, save }),
    // Line hunt days and runs: see hunt-local.js.
    ...createLocalHunt({ load, save }),
    // Spaced review boxes and sessions: see review-local.js.
    ...createLocalReview({ load, save }),
    // Interrogations (guided debugging per case): see interrogation-local.js.
    ...createLocalInterrogations({ load, save }),
  }
}
