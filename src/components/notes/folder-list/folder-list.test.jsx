import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { NOTE_FOLDER_LIMITS } from '../../../../shared/note-folders.js'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import FolderList, { NOTE_DRAG } from './folder-list.jsx'

const FOLDERS = [
  { id: 'f1', name: 'Work', position: 0 },
  { id: 'f2', name: 'Study', position: 1 },
  { id: 'f3', name: 'Ideas', position: 2 },
]
const COUNTS = { all: 5, none: 2, byFolder: new Map([['f1', 2], ['f2', 1], ['f3', 0]]) }
let props

function setup(overrides = {}, locale = 'en') {
  props = {
    folders: FOLDERS,
    counts: COUNTS,
    current: null,
    linkFor: (value) => (value ? `/notes?folder=${value}` : '/notes'),
    open: true,
    onToggle: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(),
    onRename: vi.fn().mockResolvedValue(),
    onDelete: vi.fn().mockResolvedValue(),
    onReorder: vi.fn(),
    onMoveNote: vi.fn(),
    ...overrides,
  }
  return render(
    <I18nProvider locale={locale}>
      <MemoryRouter>
        <FolderList {...props} />
      </MemoryRouter>
    </I18nProvider>,
  )
}

// A drag as the browser sends it: the data set on dragstart, read back on drop.
function dataTransfer(data) {
  return { types: Object.keys(data), getData: (type) => data[type] ?? '', setData: vi.fn(), effectAllowed: '' }
}

const nav = () => screen.getByRole('navigation', { name: 'Folders' })
const link = (name) => within(nav()).getByRole('link', { name })

beforeEach(() => {
  localStorage.clear()
})

it('lists all notes, no folder and my folders with counts, as links marking the current one', () => {
  setup({ current: 'f2' })
  const links = within(nav()).getAllByRole('link')
  expect(links.map((item) => item.getAttribute('aria-label'))).toEqual(['All notes, 5 notes', 'No folder, 2 notes', 'Work, 2 notes', 'Study, 1 note', 'Ideas, 0 notes'])
  expect(link('Study, 1 note')).toHaveAttribute('aria-current', 'page')
  expect(link('Study, 1 note')).toHaveAttribute('href', '/notes?folder=f2')
  expect(link('No folder, 2 notes')).toHaveAttribute('href', '/notes?folder=none')
  expect(link('All notes, 5 notes')).not.toHaveAttribute('aria-current')
})

it('collapses behind its heading, still naming the folder on screen', async () => {
  setup({ open: false, current: 'f1' })
  const toggle = screen.getByRole('button', { name: /Folders/ })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(toggle).toHaveTextContent('Work')
  expect(within(nav()).queryByRole('link')).not.toBeInTheDocument()
  await userEvent.click(toggle)
  expect(props.onToggle).toHaveBeenCalled()
})

it('creates a folder, checking the name first', async () => {
  setup()
  await userEvent.click(screen.getByRole('button', { name: 'New folder' }))
  const field = screen.getByRole('textbox', { name: 'New folder' })
  expect(field).toHaveFocus()
  expect(field).toHaveAttribute('maxLength', String(NOTE_FOLDER_LIMITS.name))
  await userEvent.click(screen.getByRole('button', { name: 'Create' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Give the folder a name.')
  expect(props.onCreate).not.toHaveBeenCalled()

  await userEvent.type(field, '  Estudos   de JS {Enter}')
  expect(props.onCreate).toHaveBeenCalledWith('Estudos de JS')
  expect(screen.queryByRole('textbox', { name: 'New folder' })).not.toBeInTheDocument()
})

it('shows the server refusal, like a name already taken', async () => {
  setup({ onCreate: vi.fn().mockRejectedValue(new Error('You already have a folder with that name.')) })
  await userEvent.click(screen.getByRole('button', { name: 'New folder' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'New folder' }), 'work{Enter}')
  expect(await screen.findByRole('alert')).toHaveTextContent('You already have a folder with that name.')
  expect(screen.getByRole('textbox', { name: 'New folder' })).toHaveValue('work')
})

it('stops at 30 folders', () => {
  setup({ folders: Array.from({ length: NOTE_FOLDER_LIMITS.folders }, (_, index) => ({ id: `f${index}`, name: `F${index}`, position: index })) })
  expect(screen.getByRole('button', { name: 'New folder' })).toBeDisabled()
  expect(screen.getByText('You have 30 folders, the most there can be.')).toBeInTheDocument()
})

it('renames inline from the folder menu, and with F2; Escape cancels', async () => {
  setup()
  await userEvent.click(screen.getByRole('button', { name: 'Options for Work' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
  const field = screen.getByRole('textbox', { name: 'Folder name' })
  expect(field).toHaveValue('Work')
  await userEvent.clear(field)
  await userEvent.type(field, 'Trabalho{Enter}')
  expect(props.onRename).toHaveBeenCalledWith('f1', 'Trabalho')

  link('Study, 1 note').focus()
  await userEvent.keyboard('{F2}')
  await userEvent.type(screen.getByRole('textbox', { name: 'Folder name' }), 'x{Escape}')
  expect(screen.queryByRole('textbox', { name: 'Folder name' })).not.toBeInTheDocument()
  expect(props.onRename).toHaveBeenCalledTimes(1)
})

it('deletes only after a confirm that says the notes are kept', async () => {
  setup()
  await userEvent.click(screen.getByRole('button', { name: 'Options for Study' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete folder' }))
  expect(screen.getByText('Delete "Study"? Its notes move to No folder.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Keep it' })).toHaveFocus()
  await userEvent.click(screen.getByRole('button', { name: 'Keep it' }))
  expect(props.onDelete).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('button', { name: 'Options for Study' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete folder' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
  expect(props.onDelete).toHaveBeenCalledWith('f2')
})

it('reorders with Alt+Up and Alt+Down, and from the menu', async () => {
  setup()
  link('Study, 1 note').focus()
  await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
  expect(props.onReorder).toHaveBeenLastCalledWith('f2', 0)
  await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
  expect(props.onReorder).toHaveBeenLastCalledWith('f2', 2)
  await userEvent.click(screen.getByRole('button', { name: 'Options for Work' }))
  expect(screen.getByRole('menuitem', { name: 'Move up' })).toBeDisabled()
  await userEvent.click(screen.getByRole('menuitem', { name: 'Move down' }))
  expect(props.onReorder).toHaveBeenLastCalledWith('f1', 1)
})

it('takes a note dropped on a folder, or on No folder to take it out', () => {
  setup()
  const target = link('Ideas, 0 notes').closest('li')
  const drag = dataTransfer({ [NOTE_DRAG]: 'n7' })
  const over = fireEvent.dragOver(target, { dataTransfer: drag })
  // Accepting the drop (preventDefault) is what lets the browser drop there.
  expect(over).toBe(false)
  fireEvent.drop(target, { dataTransfer: drag })
  expect(props.onMoveNote).toHaveBeenCalledWith('n7', 'f3')

  fireEvent.drop(link('No folder, 2 notes').closest('li'), { dataTransfer: dataTransfer({ [NOTE_DRAG]: 'n7' }) })
  expect(props.onMoveNote).toHaveBeenLastCalledWith('n7', null)
})

it('ignores drags of anything else, and reorders a folder dropped on another', () => {
  setup()
  const target = link('Work, 2 notes').closest('li')
  expect(fireEvent.dragOver(target, { dataTransfer: dataTransfer({ 'text/plain': 'hi' }) })).toBe(true)
  const start = dataTransfer({})
  fireEvent.dragStart(link('Ideas, 0 notes').closest('li'), { dataTransfer: start })
  expect(start.setData).toHaveBeenCalledWith('application/x-glitch-folder', 'f3')
  fireEvent.drop(target, { dataTransfer: dataTransfer({ 'application/x-glitch-folder': 'f3' }) })
  expect(props.onReorder).toHaveBeenCalledWith('f3', 0)
  expect(props.onMoveNote).not.toHaveBeenCalled()
})

it('speaks Brazilian Portuguese', () => {
  setup({}, 'pt-BR')
  const folders = screen.getByRole('navigation', { name: 'Pastas' })
  expect(within(folders).getByRole('link', { name: 'Todas as notas, 5 notas' })).toBeInTheDocument()
  expect(within(folders).getByRole('link', { name: 'Sem pasta, 2 notas' })).toBeInTheDocument()
  expect(within(folders).getByRole('link', { name: 'Study, 1 nota' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Nova pasta' })).toHaveTextContent('+ Pasta')
  expect(screen.getByRole('button', { name: 'Opções de Work' })).toBeInTheDocument()
})
