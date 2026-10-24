import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNote,
  createNoteFolder,
  deleteNote,
  deleteNoteFolder,
  getMyProfile,
  listCases,
  listNoteFolders,
  listNotes,
  moveNoteToFolder,
  noteAi,
  setNotePublic,
  updateNote,
  updateNoteFolder,
} from '../../lib/api.js'
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
  listNoteFolders: vi.fn(),
  createNoteFolder: vi.fn(),
  updateNoteFolder: vi.fn(),
  deleteNoteFolder: vi.fn(),
  moveNoteToFolder: vi.fn(),
  noteAi: vi.fn(),
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
  vi.mocked(listNoteFolders).mockReset().mockResolvedValue([])
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

describe('tags', () => {
  const TAGGED = [
    { ...NOTE, id: 'n1', title: 'Loops in JS', tags: ['loops', 'javascript', 'arrays', 'c#', 'laço'] },
    { ...NOTE, id: 'n2', title: 'Python loops', tags: ['loops', 'python'], blocks: [] },
    { ...NOTE, id: 'n3', title: 'Plain', tags: [], blocks: [{ id: 'p', type: 'text', text: 'nothing tagged' }] },
  ]
  const listed = () => within(screen.getByRole('navigation', { name: 'Notes' })).queryAllByRole('link').map((link) => link.querySelector('span').textContent)
  const filterChip = (name) => screen.getByRole('button', { name })

  beforeEach(() => {
    vi.mocked(listNotes).mockResolvedValue(TAGGED)
  })

  it('saves the tags I add with the autosave', async () => {
    renderAt('/notes/n3', { user: 'alice' })
    await userEvent.type(await screen.findByRole('combobox', { name: 'Tags' }), 'Loops{Enter}python,')
    await waitFor(() => expect(updateNote).toHaveBeenCalledWith('n3', expect.objectContaining({ tags: ['loops', 'python'] }), 'token-alice', undefined), { timeout: 2000 })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    // My other notes' tags are offered as I type.
    await userEvent.type(screen.getByRole('combobox', { name: 'Tags' }), 'arr')
    expect(screen.getByRole('option', { name: '#arrays' })).toBeInTheDocument()
  })

  it('shows the first 3 chips of each note and how many more', async () => {
    renderAt('/notes', { user: 'alice' })
    const link = await screen.findByRole('link', { name: /Loops in JS/ })
    const tags = within(link).getByRole('list')
    expect(within(tags).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['#loops', '#javascript', '#arrays', '+22 more tags'])
  })

  it('filters by tags (all of them), keeps it in the address and clears it', async () => {
    renderAt('/notes', { user: 'alice' })
    await userEvent.click(await screen.findByRole('button', { name: 'loops, 2 notes' }))
    expect(currentLocation()).toBe('/notes?tag=loops')
    expect(listed()).toEqual(['Loops in JS', 'Python loops'])
    expect(filterChip('loops, 2 notes')).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(filterChip('python, 1 note'))
    expect(currentLocation()).toBe('/notes?tag=loops&tag=python')
    expect(listed()).toEqual(['Python loops'])

    // Opening a note keeps the filter.
    await userEvent.click(screen.getByRole('link', { name: /Python loops/ }))
    expect(currentLocation()).toBe('/notes/n2?tag=loops&tag=python')

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(currentLocation()).toBe('/notes/n2')
    expect(listed()).toEqual(['Loops in JS', 'Python loops', 'Plain'])
  })

  it('reads the filter from the address on load and says when nothing matches', async () => {
    renderAt('/notes?tag=python&tag=Javascript', { user: 'alice' })
    expect(await screen.findByText('No notes with these tags.')).toBeInTheDocument()
    expect(listed()).toEqual([])
    expect(filterChip('python, 1 note')).toHaveAttribute('aria-pressed', 'true')
    expect(filterChip('javascript, 1 note')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Notes' })).getAllByRole('button', { name: 'Clear' }).at(-1))
    expect(listed()).toHaveLength(3)
  })

  it('finds notes by tag, title or text in the search', async () => {
    renderAt('/notes', { user: 'alice' })
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search your notes' }), 'laço')
    expect(listed()).toEqual(['Loops in JS'])
    expect(currentLocation()).toBe(`/notes?q=${encodeURIComponent('laço')}`)
    await userEvent.clear(screen.getByRole('searchbox'))
    await userEvent.type(screen.getByRole('searchbox'), 'tagged')
    expect(listed()).toEqual(['Plain'])
    await userEvent.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByText('No notes match that search.')).toBeInTheDocument()
  })

  it('speaks Brazilian Portuguese', async () => {
    renderAt('/notes?tag=python&tag=c%23', { user: 'alice', locale: 'pt-BR' })
    expect(await screen.findByText('Nenhuma nota com essas tags.')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Filtrar por tag' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'loops, 2 notas' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Limpar' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('searchbox', { name: 'Buscar nas suas notas' })).toBeInTheDocument()
  })
})

describe('folders', () => {
  const FOLDERS = [
    { id: 'f1', name: 'Work', position: 0 },
    { id: 'f2', name: 'Study', position: 1 },
  ]
  const FILED = [
    { ...NOTE, id: 'n1', title: 'Loops in JS', tags: ['javascript'], folderId: 'f1' },
    { ...NOTE, id: 'n2', title: 'Python loops', tags: ['python'], folderId: 'f2', blocks: [] },
    { ...NOTE, id: 'n3', title: 'Loose note', tags: ['javascript'], folderId: null, blocks: [] },
  ]
  const listed = () => within(screen.getByRole('navigation', { name: 'Notes' })).queryAllByRole('link').map((link) => link.querySelector('span').textContent)
  const folderNav = () => screen.getByRole('navigation', { name: 'Folders' })
  const folderLink = (name) => within(folderNav()).getByRole('link', { name })

  beforeEach(() => {
    vi.mocked(listNotes).mockResolvedValue(FILED)
    vi.mocked(listNoteFolders).mockResolvedValue(FOLDERS)
    vi.mocked(createNoteFolder).mockReset().mockImplementation(async (name) => ({ id: 'f9', name, position: 2 }))
    vi.mocked(updateNoteFolder).mockReset().mockImplementation(async (id, fields) => ({ ...FOLDERS.find((item) => item.id === id), ...fields }))
    vi.mocked(deleteNoteFolder).mockReset().mockResolvedValue()
    vi.mocked(moveNoteToFolder).mockReset().mockImplementation(async (id, folderId) => ({ ...FILED.find((item) => item.id === id), folderId }))
  })

  it('filters by folder in the address, combined with tags and search', async () => {
    renderAt('/notes', { user: 'alice' })
    await userEvent.click(await screen.findByRole('link', { name: 'Work, 1 note' }))
    expect(currentLocation()).toBe('/notes?folder=f1')
    expect(listed()).toEqual(['Loops in JS'])
    expect(folderLink('Work, 1 note')).toHaveAttribute('aria-current', 'page')

    await userEvent.click(folderLink('No folder, 1 note'))
    expect(currentLocation()).toBe('/notes?folder=none')
    expect(listed()).toEqual(['Loose note'])

    // A tag narrows inside the folder, and Clear keeps the folder.
    await userEvent.click(folderLink('All notes, 3 notes'))
    await userEvent.click(screen.getByRole('button', { name: 'javascript, 2 notes' }))
    expect(listed()).toEqual(['Loops in JS', 'Loose note'])
    await userEvent.click(folderLink('Work, 1 note'))
    expect(currentLocation()).toBe('/notes?folder=f1&tag=javascript')
    expect(listed()).toEqual(['Loops in JS'])
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Notes' })).getByRole('button', { name: 'Clear' }))
    expect(currentLocation()).toBe('/notes?folder=f1')
  })

  it('reads the folder from the address on load', async () => {
    renderAt('/notes?folder=f2', { user: 'alice' })
    expect(await screen.findByRole('link', { name: /Python loops/ })).toBeInTheDocument()
    expect(listed()).toEqual(['Python loops'])
  })

  it('shows every note for a folder that is not mine', async () => {
    renderAt('/notes?folder=nope', { user: 'alice' })
    await screen.findByRole('link', { name: /Python loops/ })
    expect(listed()).toEqual(['Loops in JS', 'Python loops', 'Loose note'])
    expect(folderLink('All notes, 3 notes')).toHaveAttribute('aria-current', 'page')
  })

  it('moves a note by dropping it on a folder, and says so', async () => {
    renderAt('/notes?folder=f1', { user: 'alice' })
    const note = await screen.findByRole('link', { name: /Loops in JS/ })
    const data = {}
    const transfer = {
      types: [],
      effectAllowed: '',
      setData: (type, value) => {
        data[type] = value
        transfer.types.push(type)
      },
      getData: (type) => data[type] ?? '',
    }
    fireEvent.dragStart(note, { dataTransfer: transfer })
    fireEvent.drop(folderLink('Study, 1 note').closest('li'), { dataTransfer: transfer })
    // Gone from Work right away.
    expect(listed()).toEqual([])
    await waitFor(() => expect(moveNoteToFolder).toHaveBeenCalledWith('n1', 'f2', 'token-alice'))
    expect(await screen.findByText('Moved to Study.')).toBeInTheDocument()
    expect(folderLink('Study, 2 notes')).toBeInTheDocument()
  })

  it('moves the open note from its "Move to folder" menu, with the keyboard', async () => {
    renderAt('/notes/n3', { user: 'alice' })
    const button = await screen.findByRole('button', { name: 'Move to folder (now: No folder)' })
    button.focus()
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(moveNoteToFolder).toHaveBeenCalledWith('n3', 'f1', 'token-alice')
    expect(await screen.findByRole('button', { name: 'Move to folder (now: Work)' })).toBeInTheDocument()
    expect(folderLink('Work, 2 notes')).toBeInTheDocument()
  })

  it('puts the note back when the move fails', async () => {
    vi.mocked(moveNoteToFolder).mockRejectedValue(new Error('Folder not found.'))
    renderAt('/notes/n3', { user: 'alice' })
    await userEvent.click(await screen.findByRole('button', { name: /Move to folder/ }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Study' }))
    expect(await screen.findByText('Folder not found.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move to folder (now: No folder)' })).toBeInTheDocument()
  })

  it('creates a folder, and a new note starts inside the folder on screen', async () => {
    vi.mocked(createNote).mockImplementation(async (fields) => ({ ...NOTE, id: 'n9', title: '', ...fields }))
    renderAt('/notes?folder=f2', { user: 'alice' })
    await userEvent.click(await screen.findByRole('button', { name: 'New folder' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'New folder' }), 'Ideas{Enter}')
    expect(createNoteFolder).toHaveBeenCalledWith('Ideas', 'token-alice')
    expect(await screen.findByRole('link', { name: 'Ideas, 0 notes' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'New note' }))
    expect(createNote).toHaveBeenCalledWith(expect.objectContaining({ folderId: 'f2' }), 'token-alice')
  })

  it('renames and reorders folders', async () => {
    renderAt('/notes', { user: 'alice' })
    await userEvent.click(await screen.findByRole('button', { name: 'Options for Work' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const field = screen.getByRole('textbox', { name: 'Folder name' })
    await userEvent.clear(field)
    await userEvent.type(field, 'Job{Enter}')
    expect(updateNoteFolder).toHaveBeenCalledWith('f1', { name: 'Job' }, 'token-alice')
    expect(await screen.findByRole('link', { name: 'Job, 1 note' })).toBeInTheDocument()

    folderLink('Study, 1 note').focus()
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
    expect(updateNoteFolder).toHaveBeenLastCalledWith('f2', { position: 0 }, 'token-alice')
    const names = within(folderNav()).getAllByRole('link').map((link) => link.getAttribute('aria-label'))
    expect(names.slice(2)).toEqual(['Study, 1 note', 'Job, 1 note'])
    // The focus stays on the folder that moved.
    expect(folderLink('Study, 1 note')).toHaveFocus()
  })

  it('deletes a folder and keeps its notes, now under No folder', async () => {
    renderAt('/notes?folder=f1', { user: 'alice' })
    await userEvent.click(await screen.findByRole('button', { name: 'Options for Work' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete folder' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
    expect(deleteNoteFolder).toHaveBeenCalledWith('f1', 'token-alice')
    await waitFor(() => expect(currentLocation()).toBe('/notes'))
    expect(listed()).toEqual(['Loops in JS', 'Python loops', 'Loose note'])
    expect(folderLink('No folder, 2 notes')).toBeInTheDocument()
    expect(within(folderNav()).queryByRole('link', { name: /Work/ })).not.toBeInTheDocument()
    expect(deleteNote).not.toHaveBeenCalled()
  })

  it('asks the AI for the open note and saves what I apply', async () => {
    const after = [
      { id: 'b1', type: 'text', text: 'Check it first.' },
      { id: 'b2', type: 'case', caseId: 'c1' },
    ]
    vi.mocked(noteAi).mockReset().mockResolvedValue({ action: 'improve', blockIds: ['b1', 'b2'], blocks: after })
    vi.mocked(listNotes).mockResolvedValue([NOTE])
    renderAt('/notes/n1', { user: 'alice' })
    await userEvent.click(await screen.findByRole('button', { name: /AI/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: /Improve writing/ }))
    expect(noteAi).toHaveBeenCalledWith('n1', { action: 'improve', blockIds: null }, 'token-alice', { signal: expect.any(AbortSignal) })
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(updateNote).toHaveBeenLastCalledWith('n1', expect.objectContaining({ blocks: after }), 'token-alice', undefined), { timeout: 2000 })
  })

  it('speaks Brazilian Portuguese', async () => {
    renderAt('/notes?folder=none', { user: 'alice', locale: 'pt-BR' })
    const nav = await screen.findByRole('navigation', { name: 'Pastas' })
    expect(within(nav).getByRole('link', { name: 'Sem pasta, 1 nota' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Todas as notas, 3 notas' })).toBeInTheDocument()
    expect(screen.getByText(/Arraste uma nota para uma pasta/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /Loose note/ }))
    expect(await screen.findByRole('button', { name: 'Mover para pasta (agora: Sem pasta)' })).toHaveTextContent('Pasta: Sem pasta')
    expect(screen.getByRole('button', { name: /IA/ })).toBeInTheDocument()
  })
})
