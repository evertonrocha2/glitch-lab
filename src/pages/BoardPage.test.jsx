import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthError, analyzeError, createNote, listCases, listNotes, startChallenge } from '../lib/api.js'
import { saveDraft, takeDraft } from '../lib/draft.js'
import { exportBoardImage, exportBoardPdf } from '../lib/exportBoard.js'
import { makeCase } from '../test/fixtures.js'
import { currentLocation, renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  analyzeError: vi.fn(),
  listCases: vi.fn(),
  startChallenge: vi.fn(),
  listNotes: vi.fn(),
  createNote: vi.fn(),
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
}))

// The image and PDF need a real browser to draw; jsdom only checks they are asked for.
vi.mock('../lib/exportBoard.js', async (importOriginal) => ({
  ...(await importOriginal()),
  exportBoardImage: vi.fn(),
  exportBoardPdf: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(listCases).mockReset().mockResolvedValue([])
  vi.mocked(analyzeError).mockReset()
  vi.mocked(startChallenge).mockReset()
  vi.mocked(listNotes).mockReset().mockResolvedValue([])
  vi.mocked(createNote).mockReset()
  vi.mocked(exportBoardImage).mockReset().mockResolvedValue()
  vi.mocked(exportBoardPdf).mockReset().mockResolvedValue()
})

const newColumn = () => screen.getByRole('region', { name: 'New' })

async function investigate(error) {
  await userEvent.type(await screen.findByLabelText('Error message'), error)
  await userEvent.click(screen.getByRole('button', { name: 'Investigate' }))
}

it('loads my cases', async () => {
  vi.mocked(listCases).mockResolvedValue([makeCase({ status: 'training', passedCount: 1 })])
  renderAt('/board', { user: 'alice' })
  expect(await screen.findByText('1/2 challenges')).toBeInTheDocument()
  expect(listCases).toHaveBeenCalledWith('token-alice')
})

it('folds the form behind New investigation once I have cases', async () => {
  vi.mocked(listCases).mockResolvedValue([makeCase()])
  renderAt('/board', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'New investigation' }))
  expect(screen.getByLabelText('Error message')).toBeInTheDocument()
})

it('Train this opens the gym', async () => {
  vi.mocked(listCases).mockResolvedValue([makeCase()])
  vi.mocked(startChallenge).mockResolvedValue({ id: 'ch9' })
  renderAt('/board', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: /TypeError/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Train this' }))
  await waitFor(() => expect(currentLocation()).toBe('/gym/ch9'))
  expect(startChallenge).toHaveBeenCalledWith('c1', 'token-alice')
})

it('Train this cannot be clicked twice', async () => {
  vi.mocked(listCases).mockResolvedValue([makeCase()])
  vi.mocked(startChallenge).mockReturnValue(new Promise(() => {}))
  renderAt('/board', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: /TypeError/ }))
  const train = screen.getByRole('button', { name: 'Train this' })
  await userEvent.click(train)
  await userEvent.click(train)
  expect(await screen.findByRole('button', { name: 'Preparing your challenge...' })).toBeDisabled()
  expect(startChallenge).toHaveBeenCalledTimes(1)
})

it('says the board is empty at first', async () => {
  renderAt('/board', { user: 'alice' })
  expect(await screen.findByText('No cases yet. Paste your first error above.')).toBeInTheDocument()
})

it('investigating adds a card to New and opens it', async () => {
  vi.mocked(analyzeError).mockResolvedValue(makeCase({ id: 'fresh' }))
  renderAt('/board', { user: 'alice' })
  await investigate('TypeError: x')
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(within(newColumn()).getByText('01')).toBeInTheDocument()
  expect(analyzeError).toHaveBeenCalledWith({ error: 'TypeError: x', code: '' }, 'token-alice')
})

it('investigates the draft from the landing right away', async () => {
  vi.mocked(analyzeError).mockResolvedValue(makeCase())
  saveDraft({ error: 'ReferenceError: y is not defined', code: 'print(y)' })
  renderAt('/board', { user: 'alice' })
  await waitFor(() =>
    expect(analyzeError).toHaveBeenCalledWith({ error: 'ReferenceError: y is not defined', code: 'print(y)' }, 'token-alice'),
  )
})

it('shows the message when the AI fails', async () => {
  vi.mocked(analyzeError).mockRejectedValue(new Error('The AI is busy right now. Try again in a minute.'))
  renderAt('/board', { user: 'alice' })
  await investigate('TypeError: x')
  expect(await screen.findByRole('alert')).toHaveTextContent('The AI is busy right now. Try again in a minute.')
})

it('sends me to login when my session expired, keeping what I pasted', async () => {
  vi.mocked(analyzeError).mockRejectedValue(new AuthError('Sign in to continue.'))
  renderAt('/board', { user: 'alice' })
  await investigate('TypeError: x')
  await waitFor(() => expect(currentLocation()).toBe('/login?next=%2Fboard'))
  expect(takeDraft()).toEqual({ error: 'TypeError: x', code: '' })
})

it('Investigate cannot be sent twice while waiting', async () => {
  vi.mocked(analyzeError).mockReturnValue(new Promise(() => {}))
  renderAt('/board', { user: 'alice' })
  await userEvent.type(await screen.findByLabelText('Error message'), 'TypeError: x')
  const button = screen.getByRole('button', { name: 'Investigate' })
  await userEvent.click(button)
  await userEvent.click(button)
  expect(await screen.findByText('Investigating your error')).toBeInTheDocument()
  expect(analyzeError).toHaveBeenCalledTimes(1)
})

it('opens the case a note linked to', async () => {
  const item = makeCase()
  vi.mocked(listCases).mockResolvedValue([item])
  renderAt(`/board?case=${item.id}`, { user: 'alice' })
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  await waitFor(() => expect(currentLocation()).toBe('/board'))
})

it('lists the notes that mention a case and starts a new one', async () => {
  const item = makeCase()
  vi.mocked(listCases).mockResolvedValue([item])
  vi.mocked(listNotes).mockResolvedValue([
    { id: 'n1', title: 'Why undefined', blocks: [{ id: 'b', type: 'case', caseId: item.id }], updatedAt: item.createdAt },
    { id: 'n2', title: 'Unrelated', blocks: [], updatedAt: item.createdAt },
  ])
  vi.mocked(createNote).mockResolvedValue({ id: 'n3', title: 'Notes on TypeError', blocks: [], updatedAt: item.createdAt })
  renderAt('/board', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: /TypeError/ }))
  const drawer = screen.getByRole('dialog')
  expect(await within(drawer).findByRole('link', { name: 'Why undefined' })).toHaveAttribute('href', '/notes/n1')
  expect(within(drawer).queryByRole('link', { name: 'Unrelated' })).toBeNull()

  await userEvent.click(within(drawer).getByRole('button', { name: 'Write a note about this' }))
  await waitFor(() => expect(currentLocation()).toBe('/notes/n3'))
  const [fields, token] = vi.mocked(createNote).mock.lastCall
  expect(token).toBe('token-alice')
  expect(fields.title).toBe('Notes on TypeError')
  expect(fields.blocks[0]).toMatchObject({ type: 'case', caseId: item.id })
})

it('exports the board as a Markdown file', async () => {
  let blob
  const keep = (value) => {
    blob = value
    return 'blob:x'
  }
  // jsdom has no object URLs: add them for this test only, then take them away again.
  URL.createObjectURL = vi.fn(keep)
  URL.revokeObjectURL = vi.fn()
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  vi.mocked(listCases).mockResolvedValue([makeCase()])
  renderAt('/board', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Export' }))
  await userEvent.click(screen.getByRole('menuitem', { name: /Markdown/ }))
  expect(click).toHaveBeenCalled()
  expect(click.mock.contexts[0].download).toMatch(/^glitch-detective-board-\d{4}-\d{2}-\d{2}\.md$/)
  const text = await blob.text()
  expect(text).toContain('# Glitch Detective board')
  expect(text).toContain('## New (1)')
  expect(exportBoardImage).not.toHaveBeenCalled()
  click.mockRestore()
  delete URL.createObjectURL
  delete URL.revokeObjectURL
})

it('exports the board as an image or a PDF', async () => {
  const item = makeCase()
  const note = { id: 'n1', title: 'Why undefined', blocks: [], updatedAt: item.createdAt }
  vi.mocked(listCases).mockResolvedValue([item])
  vi.mocked(listNotes).mockResolvedValue([note])
  renderAt('/board', { user: 'alice' })
  // Wait for the notes too, so the export carries them.
  await screen.findByRole('button', { name: /TypeError/ })
  await waitFor(() => expect(listNotes).toHaveBeenCalled())

  await userEvent.click(screen.getByRole('button', { name: 'Export' }))
  await userEvent.click(screen.getByRole('menuitem', { name: /Image/ }))
  expect(exportBoardImage).toHaveBeenCalledWith(expect.objectContaining({ cases: [item], notes: [note] }))
  expect(exportBoardPdf).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('button', { name: 'Export' }))
  await userEvent.click(screen.getByRole('menuitem', { name: /PDF/ }))
  expect(exportBoardPdf).toHaveBeenCalledWith(expect.objectContaining({ cases: [item], notes: [note] }))
  expect(exportBoardImage).toHaveBeenCalledTimes(1)
})

it('says so when a board file could not be made', async () => {
  vi.mocked(exportBoardPdf).mockRejectedValue(new Error('canvas tainted'))
  vi.mocked(listCases).mockResolvedValue([makeCase()])
  renderAt('/board', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Export' }))
  await userEvent.click(screen.getByRole('menuitem', { name: /PDF/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't make the PDF. Try again.")
})

it('speaks Portuguese: board, stats, card and drawer', async () => {
  vi.mocked(listCases).mockResolvedValue([makeCase({ status: 'training', passedCount: 1 })])
  renderAt('/board', { user: 'alice', locale: 'pt-BR' })
  expect(await screen.findByRole('heading', { level: 1, name: 'Seu board de casos' })).toBeInTheDocument()
  expect(screen.getByText('1/2 desafios')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Treinando' })).toHaveTextContent('Praticando no gym')
  const stats = screen.getByRole('list', { name: 'Resumo do board' })
  expect(within(stats).getByText('Ponto fraco')).toBeInTheDocument()
  expect(within(stats).getByText('1 caso aberto desse tipo')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: /1 de 2 desafios concluídos/ }))
  const drawer = screen.getByRole('dialog')
  expect(within(drawer).getByText('O que aconteceu')).toBeInTheDocument()
  expect(within(drawer).getByText(/^· Aberto (há|ontem)/)).toBeInTheDocument()
  await userEvent.click(within(drawer).getByRole('button', { name: 'Mostrar a correção' }))
  expect(within(drawer).getByRole('button', { name: 'Esconder a correção' })).toBeInTheDocument()
  expect(within(drawer).getByRole('button', { name: 'Treinar' })).toBeInTheDocument()
  expect(within(drawer).getByRole('button', { name: 'Escrever uma nota sobre isso' })).toBeInTheDocument()
})

it('hands the reader language to the board export', async () => {
  vi.mocked(exportBoardPdf).mockRejectedValue(new Error('canvas tainted'))
  vi.mocked(listCases).mockResolvedValue([makeCase()])
  renderAt('/board', { user: 'alice', locale: 'pt-BR' })
  await userEvent.click(await screen.findByRole('button', { name: /Export|Exportar/ }))
  await userEvent.click(screen.getByRole('menuitem', { name: /PDF/ }))
  expect(exportBoardPdf).toHaveBeenCalledWith(expect.objectContaining({ locale: 'pt-BR' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não deu para gerar o PDF. Tente de novo.')
})
