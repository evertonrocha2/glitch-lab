import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { getDuel, getProgress, sendDuel } from '../lib/api.js'
import { currentLocation, renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  getDuel: vi.fn(),
  sendDuel: vi.fn(),
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
}))

// Times relative to the moment the fixture is made; the page reads the server clock from `now`.
const iso = (offset) => new Date(Date.now() + offset).toISOString()
const ME = { name: 'Anonymous detective', handle: null, avatar: null, bot: false, you: true }
const BOT = { name: 'Glitch Bot', handle: null, avatar: null, bot: true, you: false }
const FRIEND = { name: 'Ada', handle: 'ada', avatar: { seed: 'ada', color: 'violet' }, bot: false, you: false }
const OPTIONS = [
  { id: 'python', name: 'Python' },
  { id: 'ruby', name: 'Ruby' },
  { id: 'go', name: 'Go' },
  { id: 'rust', name: 'Rust' },
]

const duel = (fields = {}) => ({
  id: 'd1',
  code: 'ABC234',
  kind: 'bot',
  status: 'active',
  now: iso(0),
  roundCount: 5,
  you: 0,
  players: [ME, BOT],
  rematchId: null,
  startAt: iso(-5000),
  scores: [0, 0],
  rounds: [],
  ...fields,
})
const countdown = (openIn = 400) => duel({ phase: 'countdown', last: null, next: { index: 0, openAt: iso(openIn) } })
const round = (current = {}, fields = {}) =>
  duel({
    phase: 'round',
    next: null,
    current: {
      index: 0,
      type: 'error',
      prompt: { text: "KeyError: 'email'" },
      options: OPTIONS,
      openAt: iso(-1000),
      deadline: iso(14_000),
      answered: [false, false],
      left: [false, false],
      myChoice: null,
      ...current,
    },
    ...fields,
  })
const closedRound = (players) => ({ index: 0, type: 'error', answer: { id: 'python', name: 'Python' }, players })
const RIGHT = { choice: 'python', correct: true, ms: 3200, left: false, points: 179 }
const WRONG = { choice: 'go', correct: false, ms: 6000, left: false, points: 0 }
const reveal = () =>
  duel({
    phase: 'reveal',
    scores: [179, 0],
    rounds: [closedRound([RIGHT, WRONG])],
    last: { ...closedRound([RIGHT, WRONG]), prompt: { text: "KeyError: 'email'" }, options: OPTIONS },
    next: { index: 1, openAt: iso(2500) },
  })
const finished = (fields = {}) =>
  duel({
    status: 'finished',
    phase: 'finished',
    scores: [179, 0],
    rounds: [closedRound([RIGHT, { ...WRONG, left: true }])],
    finishedAt: iso(0),
    result: { reason: 'score', winner: 0, forfeit: null, scores: [179, 0], rated: false, rating: null },
    ...fields,
  })

beforeEach(() => {
  vi.mocked(getDuel).mockReset()
  vi.mocked(sendDuel).mockReset()
  vi.mocked(getProgress).mockClear()
})

it('counts down, opens the round, focuses the question and answers by click', async () => {
  vi.mocked(getDuel).mockResolvedValueOnce(countdown()).mockResolvedValue(round())
  vi.mocked(sendDuel).mockResolvedValue({ duel: round({ myChoice: 'python', answered: [true, false] }) })
  renderAt('/duel/d1', { user: 'alice' })


  // On screen and in the live region.
  expect(await screen.findAllByText('Get ready')).toHaveLength(2)
  expect(screen.getByText('Stay on this tab: leaving it while a round is open costs you that round.')).toBeInTheDocument()
  const heading = await screen.findByRole('heading', { name: 'Which language printed this error?' }, { timeout: 3000 })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(screen.getByText("KeyError: 'email'")).toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '15')
  // The live region says the round is open.
  expect(screen.getByText('Round 1 of 5. Which language printed this error?')).toHaveAttribute('aria-live', 'polite')

  const answers = within(screen.getByRole('group', { name: 'Answers' })).getAllByRole('button')
  expect(answers.map((button) => button.textContent)).toEqual(['1Python', '2Ruby', '3Go', '4Rust'])
  await userEvent.click(answers[0])
  expect(sendDuel).toHaveBeenCalledWith('answer', { id: 'd1', round: 0, choice: 'python' }, 'token-alice')
  expect(await screen.findByText(/Answer locked in/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Python/ })).toHaveAttribute('aria-pressed', 'true')
  for (const button of within(screen.getByRole('group', { name: 'Answers' })).getAllByRole('button')) expect(button).toBeDisabled()
  expect(within(screen.getByRole('list', { name: 'Score' })).getAllByRole('listitem')[1]).toHaveTextContent('Glitch Bot')
})

it('answers with the number keys', async () => {
  vi.mocked(getDuel).mockResolvedValue(round())
  vi.mocked(sendDuel).mockResolvedValue({ duel: round({ myChoice: 'ruby', answered: [true, true] }) })
  renderAt('/duel/d1', { user: 'alice' })
  await screen.findByRole('heading', { name: 'Which language printed this error?' })
  await userEvent.keyboard('2')
  expect(sendDuel).toHaveBeenCalledWith('answer', { id: 'd1', round: 0, choice: 'ruby' }, 'token-alice')
  await screen.findByText(/Answer locked in/)
  // Locked in: more keys do nothing.
  await userEvent.keyboard('3')
  expect(sendDuel).toHaveBeenCalledTimes(1)
})

it('reports leaving the tab and warns that the round is lost', async () => {
  vi.mocked(getDuel).mockResolvedValue(round())
  vi.mocked(sendDuel).mockResolvedValue({ recorded: true })
  renderAt('/duel/d1', { user: 'alice' })
  await screen.findByRole('heading', { name: 'Which language printed this error?' })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()

  act(() => {
    window.dispatchEvent(new Event('blur'))
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('You left the tab during this round, so it counts 0 for you.')
  await waitFor(() => expect(sendDuel).toHaveBeenCalledWith('focus', { id: 'd1', state: 'hidden' }, 'token-alice', { keepalive: true }))
  // blur and visibilitychange both fire when switching tabs: one report each way.
  act(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  act(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    window.dispatchEvent(new Event('focus'))
  })
  await waitFor(() => expect(sendDuel).toHaveBeenCalledWith('focus', { id: 'd1', state: 'visible' }, 'token-alice', { keepalive: true }))
  expect(vi.mocked(sendDuel).mock.calls.filter(([action]) => action === 'focus')).toHaveLength(2)
})

it('says it is back after a reload, when the server still has me away', async () => {
  vi.mocked(getDuel).mockResolvedValue(round({}, { away: true }))
  vi.mocked(sendDuel).mockResolvedValue({ recorded: true })
  renderAt('/duel/d1', { user: 'alice' })
  await waitFor(() => expect(sendDuel).toHaveBeenCalledWith('focus', { id: 'd1', state: 'visible' }, 'token-alice', { keepalive: true }))
  expect(sendDuel).toHaveBeenCalledTimes(1)
})

it('says it is away on load when the page opens in a background tab', async () => {
  vi.mocked(getDuel).mockResolvedValue(round())
  vi.mocked(sendDuel).mockResolvedValue({ recorded: true })
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
  try {
    renderAt('/duel/d1', { user: 'alice' })
    await waitFor(() => expect(sendDuel).toHaveBeenCalledWith('focus', { id: 'd1', state: 'hidden' }, 'token-alice', { keepalive: true }))
    expect(sendDuel).toHaveBeenCalledTimes(1)
  } finally {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  }
})

it("shows the server's tab flag for me and for the other player", async () => {
  vi.mocked(getDuel).mockResolvedValue(round({ left: [true, true], answered: [false, true] }))
  renderAt('/duel/d1', { user: 'alice' })
  expect(await screen.findByRole('alert')).toHaveTextContent('You left the tab')
  const [mine, theirs] = within(screen.getByRole('list', { name: 'Score' })).getAllByRole('listitem')
  expect(mine).toHaveTextContent('left the tab')
  expect(theirs).toHaveTextContent('Answered')
  expect(theirs).toHaveTextContent('left the tab')
})

it('reveals the answer between rounds and announces the round result', async () => {
  vi.mocked(getDuel).mockResolvedValue(reveal())
  renderAt('/duel/d1', { user: 'alice' })
  expect(await screen.findByRole('heading', { name: 'Round 1: the answer was Python' })).toBeInTheDocument()
  expect(screen.getByText('Right answer')).toBeInTheDocument()
  expect(screen.getByText(/Next round in [23]/)).toBeInTheDocument()
  expect(screen.getByText('Round 1: you scored 179, Glitch Bot scored 0.')).toBeInTheDocument()
})

it('shows the result, the breakdown and stops polling a finished bot duel', async () => {
  vi.mocked(getDuel).mockResolvedValue(finished())
  vi.mocked(sendDuel).mockResolvedValue({ duel: countdown(3000) })
  renderAt('/duel/d1', { user: 'alice' })
  const heading = await screen.findByRole('heading', { name: 'You won!' })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(screen.getByText('Practice duel: ratings stay the same.')).toBeInTheDocument()
  const breakdown = screen.getByRole('region', { name: 'Round by round' })
  expect(breakdown).toHaveTextContent('Round 1 of 5')
  expect(breakdown).toHaveTextContent('3.2s')
  expect(breakdown).toHaveTextContent('+179')
  expect(breakdown).toHaveTextContent('left the tab')
  await waitFor(() => expect(getProgress).toHaveBeenCalled())

  await new Promise((resolve) => setTimeout(resolve, 1300))
  expect(getDuel).toHaveBeenCalledTimes(1)

  vi.mocked(sendDuel).mockResolvedValue({ duel: { ...countdown(3000), id: 'd2' } })
  await userEvent.click(screen.getByRole('button', { name: 'Play the bot again' }))
  expect(sendDuel).toHaveBeenCalledWith('bot', {}, 'token-alice')
  await waitFor(() => expect(currentLocation()).toBe('/duel/d2'))
})

it('shows the rating change and offers a rematch after a duel with a person', async () => {
  vi.mocked(getDuel).mockResolvedValue(
    finished({ kind: 'private', players: [ME, FRIEND], result: { reason: 'forfeit', winner: 0, forfeit: 1, scores: [179, 0], rated: true, rating: { before: 1000, after: 1016 } } }),
  )
  vi.mocked(sendDuel).mockResolvedValue({ duel: duel({ id: 'd3', kind: 'private', status: 'waiting', players: [ME], createdAt: iso(0) }) })
  renderAt('/duel/d1', { user: 'alice' })
  expect(await screen.findByRole('heading', { name: 'Your opponent left. You win!' })).toBeInTheDocument()
  expect(screen.getByText(/Rating 1000 → 1016/)).toHaveTextContent('(+16)')
  await userEvent.click(screen.getByRole('button', { name: 'Rematch' }))
  expect(sendDuel).toHaveBeenCalledWith('rematch', { id: 'd1' }, 'token-alice')
  await waitFor(() => expect(currentLocation()).toBe('/duel/d3'))
})

it('waits for a friend with the link and the code, then offers the Glitch Bot', async () => {
  vi.mocked(getDuel).mockResolvedValue(duel({ kind: 'private', status: 'waiting', players: [ME], createdAt: iso(-25_000) }))
  vi.mocked(sendDuel).mockResolvedValue({ duel: { ...countdown(3000), id: 'd9' } })
  renderAt('/duel/d1', { user: 'alice' })
  expect(await screen.findByRole('heading', { name: 'Waiting for your friend' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Duel link' })).toHaveValue(`${window.location.origin}/duel/d1`)
  expect(screen.getByTestId('duel-code')).toHaveTextContent('ABC234')
  expect(screen.getByText(/Waiting for 0:2[56]/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Play the Glitch Bot' }))
  expect(sendDuel).toHaveBeenCalledWith('bot', { from: 'd1' }, 'token-alice')
  await waitFor(() => expect(currentLocation()).toBe('/duel/d9'))
})

it('lets an invited friend join', async () => {
  vi.mocked(getDuel).mockResolvedValue(duel({ kind: 'private', status: 'waiting', you: null, joinable: true, players: [{ ...FRIEND, you: false }], createdAt: iso(0) }))
  vi.mocked(sendDuel).mockResolvedValue({ duel: countdown() })
  renderAt('/duel/d1', { user: 'bob' })
  expect(await screen.findByText('Ada wants to race you: 5 rounds, 15 seconds each.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Join the duel' }))
  expect(sendDuel).toHaveBeenCalledWith('join', { id: 'd1' }, 'token-bob')
  // On screen and in the live region.
  expect(await screen.findAllByText('Get ready')).toHaveLength(2)
})

it('gives up only on the second click', async () => {
  vi.mocked(getDuel).mockResolvedValue(round())
  vi.mocked(sendDuel).mockResolvedValue({ duel: finished({ result: { reason: 'forfeit', winner: 1, forfeit: 0, scores: [0, 0], rated: false, rating: null } }) })
  renderAt('/duel/d1', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Give up' }))
  expect(sendDuel).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Sure? Click again to forfeit.' }))
  expect(sendDuel).toHaveBeenCalledWith('leave', { id: 'd1' }, 'token-alice')
  expect(await screen.findByRole('heading', { name: 'You left the duel' })).toBeInTheDocument()
})

it('speaks Brazilian Portuguese', async () => {
  vi.mocked(getDuel).mockResolvedValue(round({ type: 'bug', prompt: { code: 'x = [1]\nx[1]', symptom: 'IndexError', language: 'Python' }, options: [{ id: 'off-by-one', name: 'Off by one' }, ...OPTIONS.slice(1)] }))
  renderAt('/duel/d1', { user: 'alice', locale: 'pt-BR' })
  expect(await screen.findByRole('heading', { name: 'Que tipo de bug é este?' })).toBeInTheDocument()
  expect(screen.getByText('Fique nesta aba: sair dela com uma rodada aberta faz você perder essa rodada.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Duelo' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Erro de um a mais/ })).toBeInTheDocument()
  expect(screen.getByText(/O que acontece/)).toBeInTheDocument()
  expect(screen.getByText('Rodada 1 de 5 · Bug')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Duelo' })).toHaveAttribute('href', '/duel')
  fireEvent.keyDown(window, { key: 'x' })
  expect(sendDuel).not.toHaveBeenCalled()
})
