// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CONTEXT_BUDGET, CONTEXT_LOADERS, GUIDE_BUDGET, loadContext } from '../../server/modules/assistant/context.js'
import { APP_GUIDE, guideSection } from '../../server/modules/assistant/guide.js'
import { DATA_NEEDS } from '../../server/modules/assistant/agents.js'
import { useTempStore } from './helpers.js'
import { CASE, challengeFor, SECRET } from './store-contract.js'

let store

beforeEach(async () => {
  store = await useTempStore()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

const load = (name, page = { path: '/' }, needs = DATA_NEEDS[name], userId = 'alice') => loadContext(name, store, userId, { page, needs })

it('has a loader for every specialist', () => {
  expect(Object.keys(CONTEXT_LOADERS)).toEqual(['board', 'gym', 'notes', 'study', 'guide'])
})

it('board: lists my cases and my weak spot, never the hidden fix', async () => {
  const mine = await store.createCase('alice', { ...CASE, context: 'Printing the cart' })
  await store.createCase('alice', { ...CASE, error: 'IndexError: list index out of range', concept: 'index-out-of-range' })
  await store.createCase('alice', CASE)
  const text = await load('board', { path: '/board', caseId: mine.id })
  expect(text).toContain(mine.id)
  expect(text).toContain('IndexError: list index out of range')
  expect(text).toContain('Weak spot: Reading undefined (2 open cases)')
  expect(text).toContain('Printing the cart')
  expect(text).toContain(`Open case ${mine.id}`)
  expect(text).not.toContain('Fix:')
})

it("board: never loads another student's cases, even when the page names one", async () => {
  await store.createCase('alice', CASE)
  const theirs = await store.createCase('bob', { ...CASE, error: 'SecretError: bob only' })
  const text = await load('board', { path: '/board', caseId: theirs.id })
  expect(text).not.toContain(theirs.id)
  expect(text).not.toContain('SecretError')
})

it('board: keeps only the 15 newest cases', async () => {
  for (let i = 0; i < 20; i++) await store.createCase('alice', { ...CASE, error: `Error${i}: boom` })
  const text = await load('board')
  expect(text).toContain('Error19: boom')
  expect(text).not.toContain('Error4: boom')
  expect(text).toContain('15 of 20')
})

it('board: loads only the data the router asked for', async () => {
  const mine = await store.createCase('alice', CASE)
  const text = await load('board', { path: '/board', caseId: mine.id }, ['current_case'])
  expect(text).toContain(`Open case ${mine.id}`)
  expect(text).not.toContain('Cases (newest first')
})

it('gym: shows only revealed hints and never touches the secrets', async () => {
  const kase = await store.createCase('alice', CASE)
  const challenge = await store.createChallenge('alice', challengeFor(kase.id), SECRET)
  await store.updateChallenge('alice', challenge.id, { hintsRevealed: 1, attempts: 2 })
  const secretSpy = vi.spyOn(store, 'getChallengeSecret')

  const text = await load('gym', { path: `/gym/${challenge.id}`, challengeId: challenge.id })
  expect(text).toContain(challenge.id)
  expect(text).toContain('Look at a.b')
  expect(text).toContain('hints revealed 1 of 3')
  expect(text).toContain('attempts 2')
  expect(text).toContain('console.log(a.b.c)')
  expect(text).not.toContain('What is a.b right now?')
  expect(text).not.toContain('Check a.b before reading .c')
  expect(text).not.toContain(SECRET.solution)
  expect(text).not.toContain(SECRET.bugExplanation)
  expect(secretSpy).not.toHaveBeenCalled()
})

it("gym: never loads another student's challenge", async () => {
  const kase = await store.createCase('bob', CASE)
  const theirs = await store.createChallenge('bob', { ...challengeFor(kase.id), symptom: 'Bob symptom' }, SECRET)
  const text = await load('gym', { path: `/gym/${theirs.id}`, challengeId: theirs.id })
  expect(text).not.toContain(theirs.id)
  expect(text).not.toContain('Bob symptom')
})

it('notes: lists excerpts and reads the open note in full', async () => {
  const kase = await store.createCase('alice', CASE)
  const note = await store.createNote('alice', {
    title: 'Undefined again',
    blocks: [
      { id: 'b1', type: 'heading', text: 'What I learned' },
      { id: 'b2', type: 'todo', text: 'Use ?. next time', done: true },
      { id: 'b3', type: 'case', caseId: kase.id },
    ],
  })
  await store.createNote('bob', { title: 'Bob private note', blocks: [] })
  const text = await load('notes', { path: `/notes/${note.id}`, noteId: note.id })
  expect(text).toContain(note.id)
  expect(text).toContain('Undefined again')
  expect(text).toContain('[x] Use ?. next time')
  expect(text).toContain(`[case ${kase.id}: TypeError]`)
  expect(text).not.toContain('Bob private note')
})

it('study: sums up progress, badges and how XP is earned', async () => {
  await store.createCase('alice', CASE)
  await store.addStudyTime('alice', new Date().toISOString().slice(0, 10), 1500, 86_400)
  const text = await load('study')
  expect(text).toContain('Level 1 (Rookie), 35 XP')
  expect(text).toContain('Studied today: 25m')
  expect(text).toContain('First clue')
  expect(text).toContain('XP: 10 per case')
  expect(text).toContain('No study plan saved.')
})

it('study: describes my active study trail and where each mission stands', async () => {
  const missions = [
    { id: 'm1', kind: 'reflect', title: 'Say why undefined happens', description: 'x', xp: 10 },
    { id: 'm2', kind: 'investigate', title: 'Investigate a new error', description: 'x', xp: 15 },
  ]
  const trail = await store.createTrail('alice', { title: 'Master undefined', summary: '', missions })
  await store.setMissionDone('alice', trail.id, 'm1', true)
  await store.createTrail('bob', { title: 'Bob trail', summary: '', missions })
  const text = await load('study')
  expect(text).toContain('"Master undefined", 1/2 missions done')
  expect(text).toContain('- [done] Reflect: Say why undefined happens')
  expect(text).toContain('- [next] Investigate: Investigate a new error')
  expect(text).not.toContain('Bob trail')
})

it('guide: static app knowledge, no student data', async () => {
  const noStore = new Proxy({}, { get: () => { throw new Error('guide must not read the store') } })
  const text = await loadContext('guide', noStore, 'alice', { page: { path: '/' }, needs: ['app_guide'] })
  expect(text).toContain('Board')
  expect(text).toContain('Alt+A')
})

it('guide: covers every page, including the newer games and community features', () => {
  for (const feature of ['Line hunt', 'Spaced review', 'interrogation', 'Duel', 'Events', 'Glitchdle', 'Articles', 'People directory', 'Your profile', 'notifications']) {
    expect(APP_GUIDE).toContain(feature)
  }
  for (const level of ['Rookie', 'Apprentice', 'Debugger', 'Engineer', 'Senior Engineer', 'Bug Whisperer']) expect(APP_GUIDE).toContain(level)
  expect(APP_GUIDE).toContain('26 badges')
  expect(APP_GUIDE).not.toMatch(/—/)
  expect(APP_GUIDE.length).toBeLessThan(GUIDE_BUDGET - 1000)
})

it('guide: knows a section for every route the app has', () => {
  const paths = ['/', '/login', '/board', '/gym/g1', '/interrogate/c1', '/daily', '/glitchdle', '/hunt', '/duel', '/duel/d1', '/notes', '/notes/n1', '/trail', '/progress', '/profile', '/u/ada', '/u/ada/notes/n1', '/people', '/articles', '/articles/new', '/articles/a1', '/articles/a1/edit', '/events', '/events/new', '/events/e1', '/events/e1/edit']
  for (const path of paths) expect(guideSection(path), path).not.toBeNull()
  expect(guideSection('/nope/nope/nope')).toBeNull()
})

it('guide: leads with the page the student is on', async () => {
  const text = await loadContext('guide', store, 'alice', { page: { path: '/profile' }, needs: ['app_guide'] })
  expect(text.startsWith('The student is on this page now. Your profile:')).toBe(true)
  expect(text).toContain('Make my profile public')
  expect(text).toContain('Line hunt')
  expect(text.length).toBeLessThanOrEqual(GUIDE_BUDGET)
})

it('stays inside the budget', async () => {
  for (let i = 0; i < 15; i++) await store.createCase('alice', { ...CASE, error: `E${i}: ${'x'.repeat(900)}` })
  const kase = (await store.listCases('alice'))[0]
  const text = await load('board', { path: '/board', caseId: kase.id })
  expect(text.length).toBeLessThanOrEqual(CONTEXT_BUDGET)
})
