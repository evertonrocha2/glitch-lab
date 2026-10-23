import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { advance, emptyInterrogation, INTERROGATION_STEPS } from '../../../shared/interrogation.js'
import { getInterrogation, listCases } from '../../lib/api.js'
import { makeCase } from '../../test/fixtures.js'
import { currentLocation, renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  getInterrogation: vi.fn(),
  answerInterrogation: vi.fn(),
  createNote: vi.fn(),
  listCases: vi.fn(),
  listNotes: vi.fn().mockResolvedValue([]),
}))

const AT = '2026-10-23T10:00:00.000Z'
const view = (state) => ({ ...state, steps: INTERROGATION_STEPS, finished: state.step >= 6, xp: 60 })
const pass = (state, answer) => advance(state, answer, { passed: true, feedback: `ok ${answer}`, question: '' }, AT)

beforeEach(() => {
  vi.mocked(listCases).mockReset().mockResolvedValue([makeCase()])
  vi.mocked(getInterrogation).mockReset()
})

// The board opens the case drawer from /board?case=c1.
const openDrawer = () => renderAt('/board?case=c1', { user: 'alice' })

it('offers to interrogate a fresh case and opens the page', async () => {
  vi.mocked(getInterrogation).mockResolvedValue({ case: makeCase(), interrogation: view(emptyInterrogation('c1')) })
  openDrawer()
  const start = await screen.findByRole('link', { name: 'Interrogate the bug' })
  expect(screen.getByText('+60 XP when you finish')).toBeInTheDocument()
  await userEvent.click(start)
  expect(currentLocation()).toBe('/interrogate/c1')
})

it('picks up where the student left off', async () => {
  const state = pass(pass(emptyInterrogation('c1'), 'one'), 'two')
  vi.mocked(getInterrogation).mockResolvedValue({ case: makeCase(), interrogation: view(state) })
  openDrawer()
  expect(await screen.findByRole('link', { name: 'Continue the interrogation' })).toBeInTheDocument()
  expect(screen.getByText('Step 3 of 6')).toBeInTheDocument()
})

it('shows a finished interrogation as a timeline with an export button', async () => {
  let state = emptyInterrogation('c1')
  for (const id of INTERROGATION_STEPS) state = pass(state, id)
  vi.mocked(getInterrogation).mockResolvedValue({ case: makeCase(), interrogation: view(state) })
  openDrawer()
  expect(await screen.findByRole('button', { name: 'Export as note' })).toBeEnabled()
  expect(screen.getByText('Done: every step passed.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Interrogation timeline' })).toBeInTheDocument()
  expect(screen.getByText('ok prevent')).toBeInTheDocument()
})

it('still offers the way in when the state fails to load', async () => {
  vi.mocked(getInterrogation).mockRejectedValue(new Error('offline'))
  openDrawer()
  expect(await screen.findByRole('link', { name: 'Interrogate the bug' })).toHaveAttribute('href', '/interrogate/c1')
})
