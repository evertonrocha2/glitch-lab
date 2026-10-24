import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { getDaily, getGlobalChallenge, startPuzzle, switchPuzzleLanguage } from '../../lib/api.js'
import { currentLocation, renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  getDaily: vi.fn(),
  getGlobalChallenge: vi.fn(),
  startPuzzle: vi.fn(),
  switchPuzzleLanguage: vi.fn(),
  getChallenge: vi.fn().mockReturnValue(new Promise(() => {})),
  getRiddle: vi.fn().mockReturnValue(new Promise(() => {})),
  // Today's review loads on its own (see components/review); these tests leave it loading.
  getReview: vi.fn().mockReturnValue(new Promise(() => {})),
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
}))

const card = (overrides) => ({
  kind: 'daily',
  day: '2026-10-22',
  language: 'python',
  concept: 'off-by-one',
  symptom: 'It prints 1 and 2, never 3.',
  status: 'new',
  challengeId: null,
  attempts: 0,
  switchedFrom: null,
  canSwitch: true,
  ...overrides,
})

const inHours = (hours) => new Date(Date.now() + hours * 3_600_000).toISOString()

const DAILY = () => ({
  day: '2026-10-22',
  nextResetAt: inHours(5),
  streak: 4,
  puzzles: [
    card({ id: 'p1', difficulty: 'easy', title: 'The missing last item', status: 'passed', challengeId: 'ch1', attempts: 1, canSwitch: false }),
    card({ id: 'p2', difficulty: 'medium', title: 'Not quite an adult', language: 'javascript', concept: 'wrong-comparison', status: 'open', challengeId: 'ch2', attempts: 2 }),
    card({ id: 'p3', difficulty: 'hard', title: 'The cart that remembers', concept: 'mutation-reference' }),
  ],
})

const avatar = { seed: 'abc', color: 'violet' }
const GLOBAL = () => ({
  week: '2026-10-19',
  endsAt: inHours(80),
  puzzle: card({ id: 'g1', kind: 'global', day: '2026-10-19', difficulty: 'hard', title: 'Everybody passes', language: 'javascript', concept: 'wrong-comparison' }),
  solvedCount: 3,
  leaderboard: [
    { rank: 1, name: 'Anonymous player', handle: null, avatar: null, seconds: 300, attempts: 4, firstSolver: false, isYou: false },
    { rank: 2, name: 'cy-dev', handle: 'cy-dev', avatar, seconds: 600, attempts: 1, firstSolver: false, isYou: true },
    { rank: 3, name: 'Ada', handle: 'ada-lab', avatar, seconds: 3900, attempts: 2, firstSolver: true, isYou: false },
  ],
  you: { rank: 2, seconds: 600, attempts: 1 },
})

beforeEach(() => {
  vi.mocked(getDaily).mockReset().mockResolvedValue(DAILY())
  vi.mocked(getGlobalChallenge).mockReset().mockResolvedValue(GLOBAL())
  vi.mocked(startPuzzle).mockReset()
  vi.mocked(switchPuzzleLanguage).mockReset()
})

const dailyList = () => screen.findByRole('list', { name: "Today's challenges" })

it("shows today's three puzzles with difficulty, language, bug type and my progress", async () => {
  renderAt('/daily', { user: 'alice' })
  const items = within(await dailyList()).getAllByRole('listitem')
  expect(items).toHaveLength(3)

  expect(within(items[0]).getByRole('heading', { name: 'The missing last item' })).toBeInTheDocument()
  expect(within(items[0]).getByText('easy')).toBeInTheDocument()
  expect(within(items[0]).getByText('Python')).toBeInTheDocument()
  expect(within(items[0]).getByText('Off by one')).toBeInTheDocument()
  expect(within(items[0]).getByText('Solved')).toBeInTheDocument()
  expect(within(items[0]).getByRole('button', { name: 'Review The missing last item' })).toBeInTheDocument()

  expect(within(items[1]).getByText('JavaScript')).toBeInTheDocument()
  expect(within(items[1]).getByText('In progress, 2 attempts')).toBeInTheDocument()
  expect(within(items[1]).getByRole('button', { name: 'Continue Not quite an adult' })).toBeInTheDocument()

  expect(within(items[2]).getByText('+50 XP')).toBeInTheDocument()
  expect(within(items[2]).getByRole('button', { name: 'Solve The cart that remembers' })).toBeInTheDocument()

  const stats = screen.getByRole('list', { name: 'Daily summary' })
  expect(within(stats).getByText('4d')).toBeInTheDocument()
  expect(within(stats).getByText('1/3')).toBeInTheDocument()
  expect(within(stats).getByText(/^[45]:\d{2}:\d{2}$/)).toBeInTheDocument()
  expect(getDaily).toHaveBeenCalledWith('token-alice')
})

it('starts a puzzle and opens it in the gym', async () => {
  vi.mocked(startPuzzle).mockResolvedValue({ id: 'ch9' })
  renderAt('/daily', { user: 'alice' })
  await dailyList()
  await userEvent.click(screen.getByRole('button', { name: 'Solve The cart that remembers' }))
  expect(startPuzzle).toHaveBeenCalledWith('p3', 'token-alice')
  await waitFor(() => expect(currentLocation()).toBe('/gym/ch9'))
})

it('says what went wrong when a puzzle will not start', async () => {
  vi.mocked(startPuzzle).mockRejectedValue(new Error("This challenge is over. Try today's set."))
  renderAt('/daily', { user: 'alice' })
  await dailyList()
  await userEvent.click(screen.getByRole('button', { name: 'Solve The cart that remembers' }))
  expect(await screen.findByRole('alert')).toHaveTextContent("This challenge is over. Try today's set.")
  expect(currentLocation()).toBe('/daily')
})

it('shows the global challenge with how many solved it and the leaderboard', async () => {
  renderAt('/daily', { user: 'alice' })
  const section = await screen.findByRole('region', { name: 'Global challenge' })
  expect(within(section).getByRole('heading', { name: 'Everybody passes' })).toBeInTheDocument()
  expect(within(section).getByText('3 players solved it')).toBeInTheDocument()
  expect(within(section).getByText('+100 XP')).toBeInTheDocument()
  expect(within(section).getByText(/^Ends in 3d [78]h$/)).toBeInTheDocument()

  const rows = within(within(section).getByRole('list', { name: 'Leaderboard' })).getAllByRole('listitem')
  expect(rows).toHaveLength(3)
  expect(rows[0]).toHaveTextContent('Anonymous player')
  expect(within(rows[0]).queryByRole('link')).not.toBeInTheDocument()
  expect(rows[0]).toHaveTextContent('5m 00s')
  expect(within(rows[1]).getByRole('link', { name: 'cy-dev' })).toHaveAttribute('href', '/u/cy-dev')
  expect(rows[1]).toHaveTextContent('You')
  expect(rows[2]).toHaveTextContent('First solver')
  expect(rows[2]).toHaveTextContent('1h 05m')
})

it('tells me my rank when I am outside the top 10', async () => {
  const outside = GLOBAL().leaderboard.map((entry) => ({ ...entry, isYou: false }))
  vi.mocked(getGlobalChallenge).mockResolvedValue({ ...GLOBAL(), leaderboard: outside, you: { rank: 12, seconds: 3600, attempts: 3 } })
  renderAt('/daily', { user: 'alice' })
  expect(await screen.findByText('You are #12 with 1h 00m.')).toBeInTheDocument()
})

it('invites the first solver when nobody solved the global challenge yet', async () => {
  vi.mocked(getGlobalChallenge).mockResolvedValue({ ...GLOBAL(), solvedCount: 0, leaderboard: [], you: null })
  renderAt('/daily', { user: 'alice' })
  expect(await screen.findByText('Nobody has solved it yet. Be the first.')).toBeInTheDocument()
  expect(screen.getByText('0 players solved it')).toBeInTheDocument()
})

it('starts the global challenge too', async () => {
  vi.mocked(startPuzzle).mockResolvedValue({ id: 'ch7' })
  renderAt('/daily', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Solve Everybody passes' }))
  expect(startPuzzle).toHaveBeenCalledWith('g1', 'token-alice')
  await waitFor(() => expect(currentLocation()).toBe('/gym/ch7'))
})

it('shows an error when the challenges cannot load', async () => {
  vi.mocked(getDaily).mockRejectedValue(new Error('Could not reach the server. Check your connection.'))
  renderAt('/daily', { user: 'alice' })
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.')
})

it('is in the main nav', async () => {
  renderAt('/daily', { user: 'alice' })
  const nav = screen.getByRole('navigation', { name: 'Main' })
  expect(within(nav).getByRole('link', { name: 'Daily' })).toHaveAttribute('href', '/daily')
  await dailyList()
})

it("links to today's Glitchdle", async () => {
  renderAt('/daily', { user: 'alice' })
  const teaser = await screen.findByRole('link', { name: /Glitchdle #1/ })
  expect(teaser).toHaveAttribute('href', '/glitchdle')
  await userEvent.click(teaser)
  expect(currentLocation()).toBe('/glitchdle')
})

it('links to the line hunt from a card', async () => {
  renderAt('/daily', { user: 'alice' })
  const teaser = await screen.findByRole('link', { name: /Line hunt/ })
  expect(teaser).toHaveAttribute('href', '/hunt')
  expect(teaser).toHaveTextContent('8 snippets, 20 seconds each: tap the buggy line.')
})

it('speaks Portuguese: puzzles, summary, global challenge and leaderboard', async () => {
  renderAt('/daily', { user: 'alice', locale: 'pt-BR' })
  const items = within(await screen.findByRole('list', { name: 'Desafios de hoje' })).getAllByRole('listitem')
  expect(screen.getByRole('heading', { level: 1, name: 'Desafios diários' })).toBeInTheDocument()
  expect(within(items[0]).getByText('fácil')).toBeInTheDocument()
  expect(within(items[0]).getByText('Resolvido')).toBeInTheDocument()
  expect(within(items[0]).getByRole('button', { name: 'Revisar: The missing last item' })).toBeInTheDocument()
  expect(within(items[1]).getByText('Em andamento, 2 tentativas')).toBeInTheDocument()
  expect(within(items[2]).getByText('Referência compartilhada')).toBeInTheDocument()
  expect(within(items[2]).getByRole('button', { name: 'Resolver: The cart that remembers' })).toBeInTheDocument()
  const stats = screen.getByRole('list', { name: 'Resumo do dia' })
  expect(within(stats).getByText('dias seguidos')).toBeInTheDocument()

  const section = screen.getByRole('region', { name: 'Desafio global' })
  expect(within(section).getByText('3 pessoas resolveram')).toBeInTheDocument()
  expect(within(section).getByText(/^Semana de 19/)).toBeInTheDocument()
  expect(within(section).getByText(/^Termina em 3d/)).toBeInTheDocument()
  const rows = within(within(section).getByRole('list', { name: 'Ranking' })).getAllByRole('listitem')
  expect(within(rows[1]).getByText('Você')).toBeInTheDocument()
  expect(within(rows[2]).getByText('Primeiro a resolver')).toBeInTheDocument()
  expect(within(rows[0]).getByText('4 tentativas')).toBeInTheDocument()
  expect(rows[0]).toHaveTextContent('Jogador anônimo')
})

it('asks for sign in', () => {
  renderAt('/daily')
  expect(currentLocation()).toBe('/login?next=%2Fdaily')
})

// Switching a puzzle to another programming language, once, from its card.
it('switches a card to another language after a confirm step, then shows the note instead of the button', async () => {
  vi.mocked(switchPuzzleLanguage).mockResolvedValue({
    puzzle: card({ id: 'p3', difficulty: 'hard', title: 'The cart that remembers', concept: 'mutation-reference', language: 'rust', symptom: 'The cart keeps old items.', switchedFrom: 'python', canSwitch: false }),
    challenge: null,
    switchedFrom: 'python',
  })
  renderAt('/daily', { user: 'alice' })
  const items = within(await dailyList()).getAllByRole('listitem')
  // Solved puzzles can't switch.
  expect(within(items[0]).queryByRole('button', { name: /Switch language/ })).not.toBeInTheDocument()

  await userEvent.click(within(items[2]).getByRole('button', { name: 'Switch language: The cart that remembers' }))
  const dialog = screen.getByRole('dialog', { name: 'Switch language' })
  expect(dialog).toHaveTextContent('This challenge is in Python.')
  const group = within(dialog).getByRole('group', { name: 'Languages' })
  expect(within(group).getAllByRole('radio').map((radio) => radio.labels[0].textContent)).toEqual([
    'JavaScript',
    'TypeScript',
    'Java',
    'C#',
    'Go',
    'Ruby',
    'PHP',
    'C',
    'C++',
    'Kotlin',
    'Rust',
    'Swift',
  ])
  expect(within(dialog).getByRole('button', { name: 'Next' })).toBeDisabled()
  await userEvent.click(within(group).getByRole('radio', { name: 'Rust' }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Next' }))

  const confirm = screen.getByRole('dialog', { name: 'Switch to Rust?' })
  expect(confirm).toHaveTextContent('You can only switch once in this challenge.')
  expect(confirm).toHaveTextContent('Same bug, same difficulty, written in Rust.')
  await userEvent.click(within(confirm).getByRole('button', { name: 'Switch to Rust' }))
  expect(switchPuzzleLanguage).toHaveBeenCalledWith('p3', 'rust', 'token-alice')

  expect(await within(items[2]).findByText('Switched from Python to Rust')).toBeInTheDocument()
  expect(within(items[2]).getByText('Rust')).toBeInTheDocument()
  expect(within(items[2]).getByText(/The cart keeps old items/)).toBeInTheDocument()
  expect(within(items[2]).queryByRole('button', { name: /Switch language/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('cancels a switch without calling the API', async () => {
  renderAt('/daily', { user: 'alice' })
  const items = within(await dailyList()).getAllByRole('listitem')
  await userEvent.click(within(items[1]).getByRole('button', { name: 'Switch language: Not quite an adult' }))
  // The card's own language (JavaScript) is not offered.
  expect(screen.queryByRole('radio', { name: 'JavaScript' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: 'Python' }))
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Your code starts over in Python.')
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(switchPuzzleLanguage).not.toHaveBeenCalled()
})

it('switches the global challenge too, and shows who switched on the leaderboard', async () => {
  const board = GLOBAL()
  board.leaderboard[0].switchedTo = 'javascript'
  vi.mocked(getGlobalChallenge).mockResolvedValue(board)
  vi.mocked(switchPuzzleLanguage).mockResolvedValue({ puzzle: { ...board.puzzle, language: 'go', switchedFrom: 'javascript', canSwitch: false }, challenge: null, switchedFrom: 'javascript' })
  renderAt('/daily', { user: 'alice' })
  const section = await screen.findByRole('region', { name: 'Global challenge' })
  const rows = within(within(section).getByRole('list', { name: 'Leaderboard' })).getAllByRole('listitem')
  expect(rows[0]).toHaveTextContent('Switched to JavaScript')
  expect(rows[1]).not.toHaveTextContent('Switched to')

  await userEvent.click(within(section).getByRole('button', { name: 'Switch language: Everybody passes' }))
  await userEvent.click(screen.getByRole('radio', { name: 'Go' }))
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await userEvent.click(screen.getByRole('button', { name: 'Switch to Go' }))
  expect(await within(section).findByText('Switched from JavaScript to Go')).toBeInTheDocument()
  expect(switchPuzzleLanguage).toHaveBeenCalledWith('g1', 'go', 'token-alice')
})

it('speaks Portuguese in the switch', async () => {
  const board = GLOBAL()
  board.leaderboard[0].switchedTo = 'csharp'
  vi.mocked(getGlobalChallenge).mockResolvedValue(board)
  vi.mocked(switchPuzzleLanguage).mockRejectedValue(new Error('Não deu para gerar este desafio em Go agora. Sua troca não foi usada, então dá para tentar de novo mais tarde.'))
  renderAt('/daily', { user: 'alice', locale: 'pt-BR' })
  const items = within(await screen.findByRole('list', { name: 'Desafios de hoje' })).getAllByRole('listitem')
  const section = screen.getByRole('region', { name: 'Desafio global' })
  expect(within(section).getByText('Trocou para C#')).toBeInTheDocument()

  await userEvent.click(within(items[2]).getByRole('button', { name: 'Trocar linguagem: The cart that remembers' }))
  const dialog = screen.getByRole('dialog', { name: 'Trocar linguagem' })
  expect(dialog).toHaveTextContent('Este desafio está em Python.')
  await userEvent.click(within(within(dialog).getByRole('group', { name: 'Linguagens' })).getByRole('radio', { name: 'Go' }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Avançar' }))
  const confirm = screen.getByRole('dialog', { name: 'Trocar para Go?' })
  expect(confirm).toHaveTextContent('Você só pode trocar uma vez neste desafio.')
  await userEvent.click(within(confirm).getByRole('button', { name: 'Trocar para Go' }))
  expect(await within(confirm).findByRole('alert')).toHaveTextContent('Sua troca não foi usada')
  expect(within(confirm).getByRole('button', { name: 'Voltar' })).toBeEnabled()
})
