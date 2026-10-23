// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { validateActions } from '../../server/modules/assistant/actions.js'
import { useTempStore } from './helpers.js'
import { CASE, challengeFor, SECRET } from './store-contract.js'

let store
let mine
let theirs
let note
let challenge

beforeEach(async () => {
  store = await useTempStore()
  mine = await store.createCase('alice', CASE)
  theirs = await store.createCase('bob', CASE)
  note = await store.createNote('alice', { title: 'Mine', blocks: [] })
  challenge = await store.createChallenge('alice', challengeFor(mine.id), SECRET)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

const check = (actions) => validateActions(store, 'alice', actions)

it('turns valid actions into links the app can follow', async () => {
  const actions = await check([
    { type: 'open_case', target: mine.id, label: 'Open the case' },
    { type: 'open_note', target: note.id, label: 'Read your note' },
    { type: 'train_case', target: mine.id, label: 'Train it' },
  ])
  expect(actions).toEqual([
    { type: 'open_case', target: mine.id, label: 'Open the case', href: `/board?case=${mine.id}` },
    { type: 'open_note', target: note.id, label: 'Read your note', href: `/notes/${note.id}` },
    { type: 'train_case', target: mine.id, label: 'Train it' },
  ])
})

it('allows the timer and known pages', async () => {
  const actions = await check([
    { type: 'start_timer', target: 'whatever', label: '' },
    { type: 'go', target: '/progress', label: 'See progress' },
    { type: 'go', target: `/gym/${challenge.id}`, label: 'Back to the gym' },
  ])
  expect(actions).toEqual([
    { type: 'start_timer', target: '', label: 'Start the study timer' },
    { type: 'go', target: '/progress', label: 'See progress', href: '/progress' },
    { type: 'go', target: `/gym/${challenge.id}`, label: 'Back to the gym', href: `/gym/${challenge.id}` },
  ])
})

it("drops ids that aren't mine, unknown pages and unknown types", async () => {
  const bobNote = await store.createNote('bob', { title: 'Bob', blocks: [] })
  const actions = await check([
    { type: 'open_case', target: theirs.id, label: 'x' },
    { type: 'train_case', target: theirs.id, label: 'x' },
    { type: 'open_note', target: bobNote.id, label: 'x' },
    { type: 'go', target: 'https://evil.dev', label: 'x' },
    { type: 'go', target: '/admin', label: 'x' },
    { type: 'go', target: '/gym/not-mine', label: 'x' },
    { type: 'delete_everything', target: mine.id, label: 'x' },
    { type: 'open_case', target: 'x'.repeat(100), label: 'x' },
    null,
    'open_case',
  ])
  expect(actions).toEqual([])
})

it('keeps at most three, skips repeats and shortens labels', async () => {
  const actions = await check([
    { type: 'go', target: '/board', label: 'a'.repeat(80) },
    { type: 'go', target: '/board', label: 'Again' },
    { type: 'go', target: '/notes', label: 'Notes' },
    { type: 'start_timer', target: '', label: 'Go' },
    { type: 'go', target: '/progress', label: 'Progress' },
  ])
  expect(actions.map((item) => item.target)).toEqual(['/board', '/notes', ''])
  expect(actions[0].label.length).toBeLessThanOrEqual(40)
})

it('accepts a missing list', async () => {
  expect(await check(undefined)).toEqual([])
})
