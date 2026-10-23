import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { buildTrail, createNote, getProgress, getTrail, setTrailMission, startChallenge } from '../../lib/api.js'
import { localDay } from '../../lib/day.js'
import { currentLocation, renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getTrail: vi.fn(),
  buildTrail: vi.fn(),
  setTrailMission: vi.fn(),
  startChallenge: vi.fn(),
  createNote: vi.fn(),
}))

const mission = (id, kind, status, fields = {}) => ({ id, kind, status, title: `${kind} mission`, description: `Do the ${kind} thing.`, xp: { train: 40, note: 15, study: 20, investigate: 15, reflect: 10 }[kind], ...fields })

const TRAIL = {
  id: 'tr1',
  title: 'Index and undefined bootcamp',
  summary: 'Your weak spot first.',
  createdAt: '2026-10-20T00:00:00.000Z',
  missions: [
    mission('m1', 'train', 'done', { caseId: 'c1', concept: 'index-out-of-range', title: 'Beat a list index challenge' }),
    mission('m2', 'train', 'next', { caseId: 'c2', concept: 'undefined-access', title: 'Train your undefined case' }),
    mission('m3', 'note', 'todo', { caseId: 'c2', concept: 'undefined-access', title: 'Write down the rule' }),
    mission('m4', 'study', 'todo', { minutes: 30, studiedMinutes: 12, title: 'Study for 30 minutes' }),
    mission('m5', 'investigate', 'todo', { concept: 'off-by-one', title: 'Investigate an off-by-one bug' }),
    mission('m6', 'reflect', 'todo', { title: 'Explain why lists start at 0' }),
  ],
  doneCount: 1,
  total: 6,
  complete: false,
  xp: 40,
  xpTotal: 240,
}
const page = (trail, extra = {}) => ({ trail, history: [], sources: { cases: 3, notes: 2 }, ...extra })
const card = (title) => screen.getByRole('heading', { name: title }).closest('li')

beforeEach(() => {
  localStorage.clear()
  vi.mocked(getTrail).mockReset().mockResolvedValue(page(TRAIL))
  vi.mocked(buildTrail).mockReset()
  vi.mocked(setTrailMission).mockReset()
  vi.mocked(startChallenge).mockReset()
  vi.mocked(createNote).mockReset()
  vi.mocked(getProgress).mockClear()
})

it('has a Trail link in the top bar', async () => {
  renderAt('/trail', { user: 'alice' })
  expect(screen.getByRole('link', { name: 'Trail' })).toHaveAttribute('href', '/trail')
  await screen.findByRole('heading', { name: TRAIL.title })
})

it('says what a new trail is built from and builds one', async () => {
  vi.mocked(getTrail).mockResolvedValue(page(null))
  let finish
  vi.mocked(buildTrail).mockReturnValue(new Promise((resolve) => (finish = resolve)))
  renderAt('/trail', { user: 'alice' })

  expect(await screen.findByText(/your 3 cases and 2 notes/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Build my study trail' }))
  expect(buildTrail).toHaveBeenCalledWith(localDay(), 'token-alice')
  expect(screen.getByText('Building your study trail').closest('[role="status"]')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Build my study trail' })).toBeNull()

  finish(page(TRAIL))
  expect(await screen.findByRole('heading', { name: TRAIL.title })).toBeInTheDocument()
  expect(screen.getAllByRole('listitem', { name: /Mission \d/ })).toHaveLength(6)
})

it('sends a student without cases to the board first', async () => {
  vi.mocked(getTrail).mockResolvedValue(page(null, { sources: { cases: 0, notes: 0 } }))
  renderAt('/trail', { user: 'alice' })
  expect(await screen.findByRole('button', { name: 'Build my study trail' })).toBeDisabled()
  expect(screen.getByRole('link', { name: 'Go to the board' })).toHaveAttribute('href', '/board')
})

it('shows the trail as numbered missions with status, xp and progress', async () => {
  renderAt('/trail', { user: 'alice' })
  expect(await screen.findByRole('heading', { name: TRAIL.title })).toBeInTheDocument()
  expect(screen.getByText('Your weak spot first.')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Missions done' })).toHaveAttribute('aria-valuenow', '1')
  expect(screen.getByText('1/6 missions')).toBeInTheDocument()
  expect(screen.getByText('40/240 XP')).toBeInTheDocument()

  const done = card('Beat a list index challenge')
  expect(done).toHaveAccessibleName('Mission 1: done')
  expect(within(done).getByText('+40 XP')).toBeInTheDocument()
  expect(within(done).getByText('Index out of range')).toBeInTheDocument()
  expect(within(done).queryByRole('button')).toBeNull()

  expect(card('Train your undefined case')).toHaveAccessibleName('Mission 2: next up')
  expect(card('Write down the rule')).toHaveAccessibleName('Mission 3: to do')
  expect(within(card('Study for 30 minutes')).getByText('12/30 min')).toBeInTheDocument()
})

it('trains a case from its mission', async () => {
  vi.mocked(startChallenge).mockResolvedValue({ id: 'ch9' })
  renderAt('/trail', { user: 'alice' })
  await screen.findByRole('heading', { name: TRAIL.title })
  await userEvent.click(within(card('Train your undefined case')).getByRole('button', { name: 'Train this case' }))
  expect(startChallenge).toHaveBeenCalledWith('c2', 'token-alice')
  await waitFor(() => expect(currentLocation()).toBe('/gym/ch9'))
})

it('opens a new note with the case already in it', async () => {
  vi.mocked(createNote).mockResolvedValue({ id: 'n9' })
  renderAt('/trail', { user: 'alice' })
  await screen.findByRole('heading', { name: TRAIL.title })
  await userEvent.click(within(card('Write down the rule')).getByRole('button', { name: 'Write the note' }))
  const [fields, token] = vi.mocked(createNote).mock.calls[0]
  expect(token).toBe('token-alice')
  expect(fields.title).toBe('Write down the rule')
  expect(fields.blocks[0]).toMatchObject({ type: 'case', caseId: 'c2' })
  await waitFor(() => expect(currentLocation()).toBe('/notes/n9'))
})

it('starts the study timer from a study mission', async () => {
  renderAt('/trail', { user: 'alice' })
  await screen.findByRole('heading', { name: TRAIL.title })
  await userEvent.click(within(card('Study for 30 minutes')).getByRole('button', { name: 'Start the timer' }))
  expect(within(card('Study for 30 minutes')).getByRole('button', { name: 'Timer running' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Pause the study timer' })).toBeInTheDocument()
})

it('sends investigate missions to the board', async () => {
  renderAt('/trail', { user: 'alice' })
  await screen.findByRole('heading', { name: TRAIL.title })
  expect(within(card('Investigate an off-by-one bug')).getByRole('link', { name: 'Go to the board' })).toHaveAttribute('href', '/board')
})

it('marks a reflect mission done by hand, and can undo it', async () => {
  const ticked = { ...TRAIL, doneCount: 2, xp: 50, missions: TRAIL.missions.map((item) => (item.id === 'm6' ? { ...item, status: 'done' } : item)) }
  vi.mocked(setTrailMission).mockResolvedValueOnce(ticked).mockResolvedValueOnce(TRAIL)
  renderAt('/trail', { user: 'alice' })
  await screen.findByRole('heading', { name: TRAIL.title })
  const progressCalls = vi.mocked(getProgress).mock.calls.length

  await userEvent.click(within(card('Explain why lists start at 0')).getByRole('button', { name: 'Mark as done' }))
  expect(setTrailMission).toHaveBeenCalledWith({ trailId: 'tr1', missionId: 'm6', done: true }, 'token-alice')
  expect(await screen.findByText('2/6 missions')).toBeInTheDocument()
  expect(card('Explain why lists start at 0')).toHaveAccessibleName('Mission 6: done')
  expect(vi.mocked(getProgress).mock.calls.length).toBeGreaterThan(progressCalls)

  await userEvent.click(within(card('Explain why lists start at 0')).getByRole('button', { name: 'Undo' }))
  expect(setTrailMission).toHaveBeenLastCalledWith({ trailId: 'tr1', missionId: 'm6', done: false }, 'token-alice')
  expect(await screen.findByText('1/6 missions')).toBeInTheDocument()
})

it('asks before replacing the trail with a new one', async () => {
  vi.mocked(buildTrail).mockResolvedValue(page({ ...TRAIL, id: 'tr2', title: 'Fresh trail' }, { history: [{ id: 'tr1', title: TRAIL.title, createdAt: TRAIL.createdAt, doneCount: 1, total: 6, complete: false }] }))
  renderAt('/trail', { user: 'alice' })
  await screen.findByRole('heading', { name: TRAIL.title })

  await userEvent.click(screen.getByRole('button', { name: 'Build a new trail' }))
  await userEvent.click(screen.getByRole('button', { name: 'Keep this one' }))
  expect(buildTrail).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('button', { name: 'Build a new trail' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, build a new one' }))
  expect(await screen.findByRole('heading', { name: 'Fresh trail' })).toBeInTheDocument()
  const history = screen.getByRole('list', { name: 'Earlier trails' })
  expect(within(history).getByText(TRAIL.title)).toBeInTheDocument()
  expect(within(history).getByText('1/6 done')).toBeInTheDocument()
})

it('celebrates a finished trail', async () => {
  const finished = { ...TRAIL, complete: true, doneCount: 6, xp: 240, missions: TRAIL.missions.map((item) => ({ ...item, status: 'done' })) }
  vi.mocked(getTrail).mockResolvedValue(page(finished))
  renderAt('/trail', { user: 'alice' })
  expect(await screen.findByRole('heading', { name: 'Trail complete!' })).toBeInTheDocument()
  expect(screen.getByText(/\+100 XP bonus/)).toBeInTheDocument()
  // No need to ask: the trail is done.
  await userEvent.click(screen.getAllByRole('button', { name: 'Build a new trail' })[0])
  expect(buildTrail).toHaveBeenCalled()
})

it('shows what went wrong when the AI fails', async () => {
  vi.mocked(getTrail).mockResolvedValue(page(null))
  vi.mocked(buildTrail).mockRejectedValue(new Error('The AI is busy right now. Try again in a minute.'))
  renderAt('/trail', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Build my study trail' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('The AI is busy right now. Try again in a minute.')
  expect(screen.getByRole('button', { name: 'Build my study trail' })).toBeEnabled()
})

it('lays out the trail in Brazilian Portuguese', async () => {
  vi.mocked(getTrail).mockResolvedValue(page(TRAIL, { history: [{ id: 'old', title: 'Old trail', createdAt: '2026-10-01T00:00:00.000Z', doneCount: 2, total: 5, complete: false }] }))
  renderAt('/trail', { user: 'alice', locale: 'pt-BR' })
  expect(await screen.findByRole('heading', { level: 1, name: 'Sua trilha de estudos' })).toBeInTheDocument()
  expect(screen.getByText('1/6 missões')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Missões feitas' })).toBeInTheDocument()
  expect(screen.getByRole('list', { name: 'Missões da trilha' })).toBeInTheDocument()
  expect(screen.getByRole('listitem', { name: 'Missão 2: a seguir' })).toBeInTheDocument()
  const next = card('Train your undefined case')
  expect(within(next).getByText('Lendo undefined')).toBeInTheDocument()
  expect(within(next).getByText('A seguir')).toBeInTheDocument()
  expect(within(next).getByRole('button', { name: 'Treinar este caso' })).toBeInTheDocument()
  expect(within(card('Write down the rule')).getByRole('button', { name: 'Escrever a nota' })).toBeInTheDocument()
  expect(within(card('Explain why lists start at 0')).getByRole('button', { name: 'Marcar como feita' })).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Trilhas anteriores' })).getByText('2/5 feitas')).toBeInTheDocument()
})

it('explains an empty trail in Brazilian Portuguese', async () => {
  vi.mocked(getTrail).mockResolvedValue(page(null))
  renderAt('/trail', { user: 'alice', locale: 'pt-BR' })
  expect(await screen.findByText(/seus 3 casos e 2 notas/)).toBeInTheDocument()
  expect(screen.getByText(/medalha Desbravador/)).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Tipos de missão' })).getByText('Treinar')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Montar minha trilha de estudos' })).toBeEnabled()
})
