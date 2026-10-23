import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { createNote, deleteNote, getMyProfile, listCases, listNotes, setNotePublic, updateNote } from '../../lib/api.js'
import { noteToMarkdown } from '../../lib/export-markdown.js'
import { exportNoteImage, exportNotePdf } from '../../lib/export-note.js'
import { forgetMyProfiles } from '../../lib/profile/my-profile.js'
import { currentLocation, renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  listNotes: vi.fn(),
  listCases: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  getMyProfile: vi.fn(),
  setNotePublic: vi.fn(),
}))

// The image and PDF need a real browser to draw; jsdom only checks they are asked for.
vi.mock('../../lib/export-note.js', async (importOriginal) => ({
  ...(await importOriginal()),
  exportNoteImage: vi.fn(),
  exportNotePdf: vi.fn(),
}))

const analysis = { explicacao: 'a', causa: 'b', correcao: 'c', exercicio: { enunciado: 'd', resposta: 'e' } }
const CASES = [
  { id: 'c1', status: 'training', passedCount: 1, error: "TypeError: Cannot read properties of undefined (reading 'length')", code: '', concept: 'undefined-access', language: 'javascript', analysis, createdAt: '2026-10-20T10:00:00Z' },
  { id: 'c2', status: 'new', passedCount: 0, error: 'IndexError: list index out of range', code: '', concept: 'index-out-of-range', language: 'python', analysis, createdAt: '2026-10-20T10:00:00Z' },
]
const NOTE = {
  id: 'n1',
  title: 'Undefined again',
  blocks: [
    { id: 'b1', type: 'text', text: 'Check before reading.' },
    { id: 'b2', type: 'case', caseId: 'c1' },
  ],
  updatedAt: new Date().toISOString(),
}

beforeEach(() => {
  vi.mocked(listNotes).mockReset().mockResolvedValue([NOTE])
  vi.mocked(listCases).mockReset().mockResolvedValue(CASES)
  vi.mocked(createNote).mockReset()
  vi.mocked(updateNote).mockReset().mockImplementation(async (id, fields) => ({ ...NOTE, id, ...fields, updatedAt: new Date().toISOString() }))
  vi.mocked(deleteNote).mockReset().mockResolvedValue()
  vi.mocked(exportNoteImage).mockReset().mockResolvedValue()
  vi.mocked(exportNotePdf).mockReset().mockResolvedValue()
  forgetMyProfiles()
  vi.mocked(getMyProfile).mockReset().mockResolvedValue(myProfile({ handle: 'ada_dev', isPublic: true }))
  vi.mocked(setNotePublic).mockReset().mockImplementation(async (id, isPublic) => ({ ...NOTE, id, isPublic }))
})

function myProfile(fields) {
  return {
    profile: { handle: null, displayName: 'Ada', bio: '', avatar: { seed: 'a', color: 'violet' }, featuredBadges: [], isPublic: false, ...fields },
    earnedBadges: [],
    progress: { level: 1, title: 'Rookie', xp: 0, levelXp: 0, nextLevelXp: 100 },
  }
}

const shareToggle = () => screen.findByRole('switch', { name: /Public on my profile/ })

it('shares a note on my public profile and links to it', async () => {
  renderAt('/notes/n1', { user: 'alice' })
  const toggle = await shareToggle()
  await waitFor(() => expect(toggle).toBeEnabled())
  expect(toggle).not.toBeChecked()
  expect(screen.getByText('Only you can see this note.')).toBeInTheDocument()

  await userEvent.click(toggle)
  expect(setNotePublic).toHaveBeenCalledWith('n1', true, 'token-alice')
  expect(toggle).toBeChecked()
  expect(await screen.findByRole('link', { name: 'View public page' })).toHaveAttribute('href', '/u/ada_dev/notes/n1')
  // The list marks it too.
  expect(screen.getByRole('link', { name: /Undefined again/ })).toHaveTextContent('Public')

  await userEvent.click(toggle)
  expect(setNotePublic).toHaveBeenLastCalledWith('n1', false, 'token-alice')
  await waitFor(() => expect(toggle).not.toBeChecked())
})

it('keeps the toggle off with a hint while my profile is private', async () => {
  vi.mocked(getMyProfile).mockResolvedValue(myProfile({ handle: 'ada_dev', isPublic: false }))
  renderAt('/notes/n1', { user: 'alice' })
  expect(await screen.findByText(/Make your profile public to share notes/)).toBeInTheDocument()
  expect(await shareToggle()).toBeDisabled()
  expect(screen.getByRole('link', { name: 'Go to your profile' })).toHaveAttribute('href', '/profile')
})

it('never lets a demo account share a note', async () => {
  localStorage.setItem('gd:session', JSON.stringify({ token: 'token-demo', user: { id: 'demo', email: 'demo@demo.glitch', isDemo: true } }))
  renderAt('/notes/n1')
  expect(await screen.findByText(/Demo accounts can't share notes/)).toBeInTheDocument()
  expect(await shareToggle()).toBeDisabled()
})

it('lets me take a note down even after my profile went private', async () => {
  vi.mocked(listNotes).mockResolvedValue([{ ...NOTE, isPublic: true }])
  vi.mocked(getMyProfile).mockResolvedValue(myProfile({ handle: 'ada_dev', isPublic: false }))
  renderAt('/notes/n1', { user: 'alice' })
  const toggle = await shareToggle()
  await screen.findByText(/Make your profile public to share notes/)
  expect(toggle).toBeChecked()
  expect(toggle).toBeEnabled()
  await userEvent.click(toggle)
  expect(setNotePublic).toHaveBeenCalledWith('n1', false, 'token-alice')
})

it('puts the toggle back and says why when sharing fails', async () => {
  vi.mocked(setNotePublic).mockRejectedValue(new Error('Sign up to share notes on a public profile.'))
  renderAt('/notes/n1', { user: 'alice' })
  const toggle = await shareToggle()
  await waitFor(() => expect(toggle).toBeEnabled())
  await userEvent.click(toggle)
  expect(await screen.findByText('Sign up to share notes on a public profile.')).toBeInTheDocument()
  expect(toggle).not.toBeChecked()
})

const savedBlocks = () => vi.mocked(updateNote).mock.lastCall[1].blocks

it('lists my notes and opens one with its case', async () => {
  renderAt('/notes', { user: 'alice' })
  await userEvent.click(await screen.findByRole('link', { name: /Undefined again/ }))
  expect(currentLocation()).toBe('/notes/n1')
  expect(screen.getByRole('textbox', { name: 'Note title' })).toHaveValue('Undefined again')
  expect(screen.getByRole('link', { name: 'Open TypeError on the board' })).toHaveAttribute('href', '/board?case=c1')
})

it('starts a new note and opens it', async () => {
  vi.mocked(createNote).mockResolvedValue({ id: 'n2', title: '', blocks: [{ id: 'x', type: 'text', text: '' }], updatedAt: new Date().toISOString() })
  renderAt('/notes', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'New note' }))
  await waitFor(() => expect(currentLocation()).toBe('/notes/n2'))
  expect(screen.getByRole('textbox', { name: 'Note title' })).toHaveValue('')
})

it('mentions a case with @ and saves it', async () => {
  renderAt('/notes/n1', { user: 'alice' })
  const text = await screen.findByRole('textbox', { name: 'Text' })
  await userEvent.type(text, ' See @index')
  const options = within(screen.getByRole('listbox', { name: 'Mention a case' })).getAllByRole('option')
  expect(options).toHaveLength(1)
  expect(options[0]).toHaveTextContent('IndexError: list index out of range')
  await userEvent.keyboard('{Enter}')

  expect(screen.getByRole('link', { name: 'Open IndexError on the board' })).toBeInTheDocument()
  await waitFor(() => expect(updateNote).toHaveBeenCalled(), { timeout: 2000 })
  const blocks = savedBlocks()
  expect(blocks[0]).toMatchObject({ type: 'text', text: 'Check before reading. See' })
  expect(blocks[1]).toMatchObject({ type: 'case', caseId: 'c2' })
  expect(await screen.findByText('Saved')).toBeInTheDocument()
})

it('turns an empty block into a to-do with /', async () => {
  vi.mocked(listNotes).mockResolvedValue([{ ...NOTE, blocks: [{ id: 'b1', type: 'text', text: '' }] }])
  renderAt('/notes/n1', { user: 'alice' })
  await userEvent.type(await screen.findByRole('textbox', { name: 'Text' }), '/')
  await userEvent.click(within(screen.getByRole('listbox', { name: 'Turn into' })).getByRole('option', { name: /To-do/ }))
  await userEvent.type(screen.getByRole('textbox', { name: 'To-do' }), 'Practice ?.{Enter}Second')
  expect(screen.getAllByRole('textbox', { name: 'To-do' })).toHaveLength(2)
  await userEvent.click(screen.getByRole('checkbox', { name: 'Done: Practice ?.' }))
  await waitFor(() => expect(savedBlocks()).toMatchObject([
    { type: 'todo', text: 'Practice ?.', done: true },
    { type: 'todo', text: 'Second', done: false },
  ]), { timeout: 2000 })
})

it('adds a case from the Add bar by searching', async () => {
  renderAt('/notes/n1', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: '@ Case' }))
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search your cases' }), 'python{Enter}')
  expect(screen.getByRole('link', { name: 'Open IndexError on the board' })).toBeInTheDocument()
})

it('deletes a note after confirming', async () => {
  renderAt('/notes/n1', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
  await waitFor(() => expect(currentLocation()).toBe('/notes'))
  expect(deleteNote).toHaveBeenCalledWith('n1', 'token-alice')
  expect(screen.queryByRole('link', { name: /Undefined again/ })).toBeNull()
})

it('says when a note does not exist', async () => {
  renderAt('/notes/missing', { user: 'alice' })
  expect(await screen.findByText('This note is gone. Pick another one.')).toBeInTheDocument()
})

it('saves unsent edits when I switch to another note, and shows them when I come back', async () => {
  const OTHER = { id: 'n2', title: 'Second', blocks: [{ id: 'z', type: 'text', text: '' }], updatedAt: NOTE.updatedAt }
  vi.mocked(listNotes).mockResolvedValue([NOTE, OTHER])
  let finish
  vi.mocked(updateNote).mockImplementation(
    (id, fields) =>
      new Promise((resolve) => {
        finish = () => resolve({ ...NOTE, id, ...fields })
      }),
  )
  renderAt('/notes/n1', { user: 'alice' })
  await userEvent.type(await screen.findByRole('textbox', { name: 'Note title' }), '!')
  await userEvent.click(screen.getByRole('link', { name: /Second/ }))
  expect(updateNote).toHaveBeenCalledWith('n1', expect.objectContaining({ title: 'Undefined again!' }), 'token-alice', undefined)

  // Back before the server answered: the list already has the new title.
  await userEvent.click(screen.getByRole('link', { name: /Undefined again!/ }))
  expect(screen.getByRole('textbox', { name: 'Note title' })).toHaveValue('Undefined again!')
  finish()
})

it("shows the server's reason when a save is refused", async () => {
  vi.mocked(updateNote).mockRejectedValue(new Error('Too long. A note holds up to 200 blocks.'))
  renderAt('/notes/n1', { user: 'alice' })
  await userEvent.type(await screen.findByRole('textbox', { name: 'Text' }), '!')
  expect(await screen.findByText('Too long. A note holds up to 200 blocks.', {}, { timeout: 2000 })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
})

it('caps a block at the length the server accepts', async () => {
  renderAt('/notes/n1', { user: 'alice' })
  expect(await screen.findByRole('textbox', { name: 'Text' })).toHaveAttribute('maxLength', '2000')
})

it('keeps a deleted note gone even if a save comes back after the delete', async () => {
  let finish
  vi.mocked(updateNote).mockImplementation(
    (id, fields) =>
      new Promise((resolve) => {
        finish = () => resolve({ ...NOTE, id, ...fields })
      }),
  )
  renderAt('/notes/n1', { user: 'alice' })
  await userEvent.type(await screen.findByRole('textbox', { name: 'Note title' }), '!')
  await waitFor(() => expect(updateNote).toHaveBeenCalled(), { timeout: 2000 })
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
  await waitFor(() => expect(currentLocation()).toBe('/notes'))
  await act(async () => finish())
  expect(screen.queryByRole('link', { name: /Undefined again/ })).toBeNull()
})

it('exports the note as Markdown, same as before', async () => {
  let blob
  const keep = (value) => {
    blob = value
    return 'blob:x'
  }
  // jsdom has no object URLs: add them for this test only, then take them away again.
  URL.createObjectURL = vi.fn(keep)
  URL.revokeObjectURL = vi.fn()
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  renderAt('/notes/n1', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Export' }))
  await userEvent.click(screen.getByRole('menuitem', { name: /Markdown/ }))
  expect(click.mock.contexts[0].download).toBe('undefined-again.md')
  expect(await blob.text()).toBe(noteToMarkdown(NOTE, CASES))
  expect(exportNoteImage).not.toHaveBeenCalled()
  click.mockRestore()
  delete URL.createObjectURL
  delete URL.revokeObjectURL
})

it('exports the note as it is on screen as an image or a PDF', async () => {
  renderAt('/notes/n1', { user: 'alice' })
  await userEvent.type(await screen.findByRole('textbox', { name: 'Note title' }), '!')
  await userEvent.click(screen.getByRole('button', { name: 'Export' }))
  await userEvent.click(screen.getByRole('menuitem', { name: /Image/ }))
  expect(exportNoteImage).toHaveBeenCalledWith({ note: expect.objectContaining({ id: 'n1', title: 'Undefined again!' }), cases: CASES })

  await userEvent.click(screen.getByRole('button', { name: 'Export' }))
  await userEvent.click(screen.getByRole('menuitem', { name: /PDF/ }))
  expect(exportNotePdf).toHaveBeenCalledWith({ note: expect.objectContaining({ title: 'Undefined again!' }), cases: CASES })
})

it('says so when a file could not be made', async () => {
  vi.mocked(exportNotePdf).mockRejectedValue(new Error('canvas tainted'))
  renderAt('/notes/n1', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Export' }))
  await userEvent.click(screen.getByRole('menuitem', { name: /PDF/ }))
  expect(await screen.findByText("Couldn't make the PDF. Try again.")).toBeInTheDocument()
})

it('speaks Brazilian Portuguese', async () => {
  renderAt('/notes/n1', { user: 'alice', locale: 'pt-BR' })
  expect(await screen.findByRole('heading', { level: 1, name: 'Suas notas' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Nova nota' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Título da nota' })).toHaveAttribute('placeholder', 'Sem título')
  expect(screen.getByRole('link', { name: /Undefined again/ })).toHaveTextContent('1 caso · Editada')
  // The case card uses the shared labels in Portuguese.
  expect(screen.getByText('Lendo undefined')).toBeInTheDocument()
  expect(screen.getByText('Treinando · 1/2')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Abrir TypeError no board' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument()
  const toggle = await screen.findByRole('switch', { name: /Pública no meu perfil/ })
  await waitFor(() => expect(toggle).toBeEnabled())
  expect(screen.getByText('Só você pode ver esta nota.')).toBeInTheDocument()

  // "@" finds a case by its bug type in Portuguese too.
  await userEvent.click(screen.getByRole('button', { name: '@ Caso' }))
  await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar nos seus casos' }), 'fora do intervalo')
  expect(screen.getByRole('option', { name: /IndexError/ })).toHaveTextContent('Índice fora do intervalo · python · Novo')
})

it('says an export failed in Portuguese', async () => {
  vi.mocked(exportNotePdf).mockRejectedValue(new Error('canvas tainted'))
  renderAt('/notes/n1', { user: 'alice', locale: 'pt-BR' })
  await userEvent.click(await screen.findByRole('button', { name: 'Exportar' }))
  await userEvent.click(screen.getByRole('menuitem', { name: /PDF/ }))
  expect(await screen.findByText('Não deu para gerar o PDF. Tente de novo.')).toBeInTheDocument()
})
