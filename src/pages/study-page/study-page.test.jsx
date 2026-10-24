import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { addDays } from '../../../shared/study-log.js'
import { deleteStudySession, listCases, listNotes, listStudySessions, logStudySession, startStudySession, updateStudySession } from '../../lib/api.js'
import { localDay } from '../../lib/day.js'
import { translateServerMessage } from '../../lib/i18n/serverMessages.js'
import { renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  startStudySession: vi.fn(),
  stopStudySession: vi.fn(),
  listStudySessions: vi.fn(),
  logStudySession: vi.fn(),
  updateStudySession: vi.fn(),
  deleteStudySession: vi.fn(),
  listCases: vi.fn(),
  listNotes: vi.fn(),
}))

const TODAY = localDay()
const YESTERDAY = addDays(TODAY, -1)
// A local time on a day, as the API sends it (ISO, UTC).
const at = (day, time) => new Date(`${day}T${time}:00`).toISOString()

const SESSIONS = [
  { id: 's1', day: TODAY, startedAt: at(TODAY, '09:00'), endedAt: at(TODAY, '09:45'), seconds: 2700, topic: 'Promises em JavaScript', caseId: 'c1', noteId: null, source: 'timer' },
  { id: 's2', day: TODAY, startedAt: at(TODAY, '14:00'), endedAt: at(TODAY, '14:30'), seconds: 1800, topic: 'Closures', caseId: null, noteId: 'n1', source: 'timer' },
  { id: 's3', day: YESTERDAY, startedAt: `${YESTERDAY}T12:00:00.000Z`, endedAt: null, seconds: 3600, topic: 'Promises em JavaScript', caseId: null, noteId: null, source: 'manual' },
]
const DAYS = [{ day: TODAY, seconds: 4500 }]

beforeEach(() => {
  vi.mocked(listStudySessions).mockReset().mockResolvedValue({ sessions: SESSIONS, days: DAYS })
  vi.mocked(listCases).mockReset().mockResolvedValue([{ id: 'c1', kind: 'error', error: 'TypeError: x is undefined' }])
  vi.mocked(listNotes).mockReset().mockResolvedValue([{ id: 'n1', title: 'Closures notes' }])
  vi.mocked(updateStudySession).mockReset()
  vi.mocked(deleteStudySession).mockReset().mockResolvedValue()
  vi.mocked(logStudySession).mockReset()
  vi.mocked(startStudySession).mockReset().mockResolvedValue({ id: 'new' })
})

const day = (name) => screen.getByRole('list', { name: `Sessions on ${name}` })

it('shows a skeleton, then the sessions by day with their counted time', async () => {
  renderAt('/study', { user: 'alice' })
  expect(screen.getByRole('status', { name: 'Loading your study log...' })).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
  expect(listStudySessions).toHaveBeenCalledWith({ from: addDays(TODAY, -29), to: addDays(TODAY, 1) }, 'token-alice')

  const days = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
  expect(days.indexOf('Today')).toBeLessThan(days.indexOf('Yesterday'))
  expect(screen.getByText('1h 15m counted')).toBeInTheDocument()
  expect(screen.getByText('0m counted')).toBeInTheDocument()

  // Latest first within the day, with its case or note.
  const today = within(day('Today')).getAllByRole('listitem')
  expect(today[0]).toHaveTextContent('Closures')
  expect(today[0]).toHaveTextContent('30m')
  expect(within(today[0]).getByRole('link', { name: /Closures notes/ })).toHaveAttribute('href', '/notes/n1')
  expect(within(today[1]).getByRole('link', { name: /TypeError: x is undefined/ })).toHaveAttribute('href', '/board?case=c1')

  const manual = within(day('Yesterday')).getByRole('listitem')
  expect(manual).toHaveTextContent('Manual')
  expect(manual).toHaveTextContent('No time set')
})

it('sums the week from counted time and ranks the topics', async () => {
  renderAt('/study', { user: 'alice' })
  const week = await screen.findByRole('region', { name: 'This week' })
  expect(within(week).getByText('1h 15m')).toBeInTheDocument()
  expect(within(week).getByText('3 sessions')).toBeInTheDocument()
  expect(within(week).getByText('+ 1h 00m logged by hand (not counted)')).toBeInTheDocument()
  const topics = within(week).getAllByRole('listitem').map((item) => item.textContent)
  expect(topics).toEqual(['Promises em JavaScript1h 45m', 'Closures30m'])
})

it("edits a session's topic and link", async () => {
  vi.mocked(updateStudySession).mockImplementation(async (id, fields) => ({ ...SESSIONS[1], ...fields }))
  renderAt('/study', { user: 'alice' })
  fireEvent.click(await screen.findByRole('button', { name: 'Edit the session "Closures"' }))
  fireEvent.change(screen.getByLabelText(/What did you study/), { target: { value: 'Closures and scope' } })
  fireEvent.click(screen.getByRole('button', { name: 'Remove the link to Closures notes' }))
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  expect(updateStudySession).toHaveBeenCalledWith('s2', { topic: 'Closures and scope', caseId: null, noteId: null }, 'token-alice')
  expect(within(day('Today')).getAllByRole('listitem')[0]).toHaveTextContent('Closures and scope')
})

it('deletes a session after asking, saying the counted time stays', async () => {
  renderAt('/study', { user: 'alice' })
  fireEvent.click(await screen.findByRole('button', { name: 'Delete the session "Closures"' }))
  expect(screen.getByText('The time it counted stays in your day, with its XP and streak.')).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  })
  expect(deleteStudySession).toHaveBeenCalledWith('s2', 'token-alice')
  expect(within(day('Today')).getAllByRole('listitem')).toHaveLength(1)
  expect(screen.getByText('1h 15m counted')).toBeInTheDocument()
})

it('logs a past session by hand, saying it does not count', async () => {
  vi.mocked(logStudySession).mockImplementation(async (fields) => ({
    id: 's9',
    day: fields.day,
    startedAt: `${fields.day}T12:00:00.000Z`,
    endedAt: null,
    seconds: fields.minutes * 60,
    topic: fields.topic,
    caseId: null,
    noteId: null,
    source: 'manual',
  }))
  renderAt('/study', { user: 'alice' })
  fireEvent.click(await screen.findByRole('button', { name: 'Log a session' }))
  const form = screen.getByRole('form', { name: 'Log a past session' })
  expect(within(form).getByText(/gives no XP, streak, badges or activity/)).toBeInTheDocument()

  // A topic is required.
  await act(async () => {
    fireEvent.click(within(form).getByRole('button', { name: 'Log it' }))
  })
  expect(within(form).getByRole('alert')).toHaveTextContent('Write what you studied.')
  expect(logStudySession).not.toHaveBeenCalled()

  fireEvent.change(within(form).getByLabelText('Day'), { target: { value: YESTERDAY } })
  fireEvent.click(within(form).getByRole('button', { name: '1h 30m' }))
  fireEvent.change(within(form).getByLabelText('What did you study?'), { target: { value: ' Recursion ' } })
  await act(async () => {
    fireEvent.click(within(form).getByRole('button', { name: 'Log it' }))
  })
  expect(logStudySession).toHaveBeenCalledWith({ day: YESTERDAY, minutes: 90, topic: 'Recursion', caseId: null, noteId: null }, 'token-alice')
  expect(screen.queryByRole('form', { name: 'Log a past session' })).not.toBeInTheDocument()
  expect(within(day('Yesterday')).getAllByRole('listitem')).toHaveLength(2)
})

it('sends a start time read on the reader own clock, and refuses one that ends in the future', async () => {
  vi.mocked(logStudySession).mockResolvedValue({ ...SESSIONS[2], id: 's9' })
  renderAt('/study', { user: 'alice' })
  fireEvent.click(await screen.findByRole('button', { name: 'Log a session' }))
  const form = screen.getByRole('form', { name: 'Log a past session' })
  fireEvent.change(within(form).getByLabelText('Day'), { target: { value: YESTERDAY } })
  fireEvent.change(within(form).getByLabelText(/Start time/), { target: { value: '19:30' } })
  fireEvent.change(within(form).getByLabelText('What did you study?'), { target: { value: 'Graphs' } })
  await act(async () => {
    fireEvent.click(within(form).getByRole('button', { name: 'Log it' }))
  })
  expect(logStudySession).toHaveBeenCalledWith(expect.objectContaining({ day: YESTERDAY, startedAt: new Date(`${YESTERDAY}T19:30:00`).toISOString(), minutes: 30 }), 'token-alice')

  fireEvent.click(screen.getByRole('button', { name: 'Log a session' }))
  const again = screen.getByRole('form', { name: 'Log a past session' })
  fireEvent.change(within(again).getByLabelText(/Start time/), { target: { value: '23:59' } })
  fireEvent.change(within(again).getByLabelText('What did you study?'), { target: { value: 'Graphs' } })
  await act(async () => {
    fireEvent.click(within(again).getByRole('button', { name: 'Log it' }))
  })
  // Today at 23:59 plus 30 minutes has not happened yet.
  expect(within(again).getByRole('alert')).toHaveTextContent('Pick a start time on that day that has already passed.')
  expect(logStudySession).toHaveBeenCalledTimes(1)
})

it('starts the timer from an empty log', async () => {
  vi.mocked(listStudySessions).mockResolvedValue({ sessions: [], days: [] })
  renderAt('/study', { user: 'alice' })
  expect(await screen.findByRole('heading', { name: 'Your study log is empty' })).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start the timer' }))
  })
  await waitFor(() => expect(startStudySession).toHaveBeenCalled())
  expect(screen.getByText('Studying')).toBeInTheDocument()
})

it('speaks Portuguese', async () => {
  renderAt('/study', { user: 'alice', locale: 'pt-BR' })
  expect(await screen.findByRole('heading', { name: 'Registro de estudo' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Hoje' })).toBeInTheDocument()
  expect(screen.getByText('1h 15m contados')).toBeInTheDocument()
  expect(screen.getByText('3 sessões')).toBeInTheDocument()
  expect(screen.getAllByText('Manual')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Registrar estudo' }))
  expect(screen.getByLabelText('O que você estudou?')).toHaveAttribute('placeholder', 'Ex.: Promises em JavaScript')
  expect(screen.getByText(/não dá XP, sequência, conquistas nem atividade/)).toBeInTheDocument()
})

it("translates the study log's server messages to Portuguese", () => {
  const pt = (message) => translateServerMessage(message, 'pt-BR')
  expect(pt('Keep the topic up to 120 characters.')).toBe('Escreva o tema com até 120 caracteres.')
  expect(pt('Write what you studied.')).toBe('Escreva o que você estudou.')
  expect(pt('Pick a day within the last 7 days.')).toBe('Escolha um dia dentro dos últimos 7 dias.')
  expect(pt('Log from 5 minutes to 4 hours.')).toBe('Registre de 5 minutos a 4 horas.')
  expect(pt('Pick a start time on that day that has already passed.')).toBe('Escolha um horário de início nesse dia que já tenha passado.')
  expect(pt('That note is not in your notes.')).toBe('Essa nota não está nas suas notas.')
  expect(pt('Study session not found.')).toBe('Sessão de estudo não encontrada.')
  expect(pt('Demo accounts can log 50 study sessions a day. Sign up to keep going.')).toBe(
    'Contas demo podem registrar 50 sessões de estudo por dia. Crie uma conta para continuar.',
  )
})
