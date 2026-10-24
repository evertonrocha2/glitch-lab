import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import NoteEditor from './note-editor.jsx'

const CODE = 'const x = user?.name'
const BLOCKS = [
  { id: 'h', type: 'heading', text: 'Undefind' },
  { id: 't', type: 'text', text: 'i read propertys to early' },
  { id: 'c', type: 'code', text: CODE, language: 'javascript' },
]
const IMPROVED = [
  { id: 'h', type: 'heading', text: 'Undefined' },
  { id: 't', type: 'text', text: 'I read properties too early.' },
  { id: 'c', type: 'code', text: CODE, language: 'javascript' },
]

let onSave
let onAi
let onMove

function setup({ blocks = BLOCKS, locale = 'en', folders = [], folderId = null } = {}) {
  onSave = vi.fn().mockResolvedValue()
  onMove = vi.fn()
  return render(
    <I18nProvider locale={locale}>
      <MemoryRouter>
        <NoteEditor
          note={{ id: 'n1', title: 'Reading undefined', tags: [], blocks, folderId }}
          cases={[]}
          onSave={onSave}
          onDelete={vi.fn()}
          onExport={vi.fn()}
          folders={folders}
          onMove={onMove}
          onAi={onAi}
        />
      </MemoryRouter>
    </I18nProvider>,
  )
}

const types = () => [...document.querySelectorAll('[data-block]')].map((element) => element.dataset.block)
const texts = () => screen.getAllByRole('textbox').slice(1).map((field) => field.value)
const openAi = () => userEvent.click(screen.getByRole('button', { name: /^✦ AI$|AI/ }))
const pick = async (name) => {
  await openAi()
  await userEvent.click(screen.getByRole('menuitem', { name: new RegExp(name) }))
}

beforeEach(() => {
  localStorage.clear()
  onAi = vi.fn().mockResolvedValue({ action: 'improve', blockIds: ['h', 't', 'c'], blocks: IMPROVED, cached: false })
})

it('offers the three tools for the whole note, and says code is safe', async () => {
  setup()
  await openAi()
  const menu = screen.getByRole('menu', { name: 'AI tools' })
  expect(within(menu).getAllByRole('menuitem').map((item) => item.querySelector('.font-semibold').textContent)).toEqual(['Improve writing', 'Organize', 'Summarize'])
  // No selection: no scope choice to make.
  expect(within(menu).queryByRole('menuitemradio')).not.toBeInTheDocument()
  expect(screen.getByText('Your code blocks never change.')).toBeInTheDocument()
})

it('previews before and after, and Discard leaves the note as it was', async () => {
  setup()
  await pick('Improve writing')
  const dialog = await screen.findByRole('dialog', { name: 'Improved writing' })
  expect(onAi).toHaveBeenCalledWith({ action: 'improve', blockIds: null }, expect.any(AbortSignal))
  expect(within(dialog).getByRole('region', { name: 'Before' })).toHaveTextContent('i read propertys to early')
  expect(within(dialog).getByRole('region', { name: 'After' })).toHaveTextContent('I read properties too early.')
  // Focus moved into the dialog.
  expect(dialog).toContainElement(document.activeElement)

  await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(texts()).toContain('i read propertys to early')
  expect(screen.getByRole('button', { name: /AI/ })).toHaveFocus()
})

it('Escape discards too, and Tab stays inside the dialog', async () => {
  setup()
  await pick('Improve writing')
  const dialog = await screen.findByRole('dialog')
  const apply = within(dialog).getByRole('button', { name: 'Apply' })
  apply.focus()
  await userEvent.tab()
  expect(dialog).toContainElement(document.activeElement)
  await userEvent.tab({ shift: true })
  expect(dialog).toContainElement(document.activeElement)
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(texts()).toContain('i read propertys to early')
})

it('applies as one step: the note changes, saves, and one Ctrl+Z brings the original back', async () => {
  setup()
  await pick('Improve writing')
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Apply' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(texts()).toEqual(['Undefined', 'I read properties too early.', CODE])
  expect(screen.getByText(/AI changes applied/)).toBeInTheDocument()
  await waitFor(() => expect(onSave.mock.lastCall[0].blocks).toEqual(IMPROVED), { timeout: 2000 })

  // The caret sits in the new text: one undo takes back the whole change.
  await userEvent.keyboard('{Control>}z{/Control}')
  expect(texts()).toEqual(['Undefind', 'i read propertys to early', CODE])
  await waitFor(() => expect(onSave.mock.lastCall[0].blocks).toEqual(BLOCKS), { timeout: 2000 })
})

it('the Undo next to the status works too', async () => {
  setup()
  await pick('Improve writing')
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Apply' }))
  await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
  expect(texts()).toEqual(['Undefind', 'i read propertys to early', CODE])
})

it('saves what was typed before asking the AI', async () => {
  setup()
  await userEvent.type(screen.getAllByRole('textbox')[2], '!')
  await pick('Summarize')
  await waitFor(() => expect(onAi).toHaveBeenCalled())
  expect(onSave).toHaveBeenCalled()
  expect(onSave.mock.invocationCallOrder[0]).toBeLessThan(onAi.mock.invocationCallOrder[0])
  expect(onSave.mock.lastCall[0].blocks[1].text).toBe('i read propertys to early!')
})

it('does not ask the AI when the note could not be saved', async () => {
  setup()
  onSave.mockRejectedValue(new Error('Too long.'))
  await userEvent.type(screen.getAllByRole('textbox')[2], '!')
  await pick('Organize')
  expect(await screen.findByText("Couldn't save the note, so the AI can't read it yet. Try again.")).toBeInTheDocument()
  expect(onAi).not.toHaveBeenCalled()
})

it('shows the working state, and Stop cancels the request', async () => {
  let signal
  onAi = vi.fn((_payload, received) => {
    signal = received
    return new Promise(() => {})
  })
  setup()
  await pick('Organize')
  expect(await screen.findByRole('status')).toHaveTextContent('Organizing your note...')
  expect(screen.getByRole('button', { name: /AI/ })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
  expect(signal.aborted).toBe(true)
  expect(screen.queryByText('Organizing your note...')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(texts()).toContain('i read propertys to early')
})

it('shows what went wrong, in the server words', async () => {
  onAi = vi.fn().mockRejectedValue(new Error("Couldn't improve this without touching your code. Nothing was changed."))
  setup()
  await pick('Organize')
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't improve this without touching your code.")
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

describe('scope', () => {
  it('works on blocks picked from their menus, or on the whole note when I say so', async () => {
    onAi = vi.fn().mockResolvedValue({ action: 'improve', blockIds: ['t'], blocks: [{ id: 't', type: 'text', text: 'I read properties too early.' }] })
    setup()
    const handles = screen.getAllByRole('button', { name: 'Block options' })
    await userEvent.click(handles[1])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Select for AI' }))
    expect(document.querySelector('[data-selected]').dataset.block).toBe('text')

    await openAi()
    const selection = screen.getByRole('menuitemradio', { name: 'The selected block' })
    expect(selection).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('menuitem', { name: /Improve writing/ }))
    expect(onAi).toHaveBeenLastCalledWith({ action: 'improve', blockIds: ['t'] }, expect.any(AbortSignal))
    const dialog = await screen.findByRole('dialog')
    // Only the selected block is in the "before".
    expect(within(dialog).getByRole('region', { name: 'Before' })).not.toHaveTextContent('Undefind')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))
    expect(texts()).toEqual(['Undefind', 'I read properties too early.', CODE])
    // Applying clears the selection.
    expect(document.querySelector('[data-selected]')).toBeNull()
  })

  it('switches to the whole note from the menu', async () => {
    setup()
    await userEvent.click(screen.getAllByRole('button', { name: 'Block options' })[0])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Select for AI' }))
    await openAi()
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'The whole note' }))
    // A scope choice keeps the menu open for the action.
    expect(screen.getByRole('menuitemradio', { name: 'The whole note' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('menuitem', { name: /Summarize/ }))
    expect(onAi).toHaveBeenLastCalledWith({ action: 'summarize', blockIds: null }, expect.any(AbortSignal))
  })

  it('takes the block where text is selected', async () => {
    onAi = vi.fn().mockResolvedValue({ action: 'improve', blockIds: ['t'], blocks: [{ id: 't', type: 'text', text: 'Better.' }] })
    setup()
    const field = screen.getAllByRole('textbox')[2]
    field.focus()
    field.setSelectionRange(2, 6)
    // The AI button reads the selection before it takes the focus.
    await userEvent.click(screen.getByRole('button', { name: /AI/ }))
    expect(screen.getByRole('menuitemradio', { name: 'The selected block' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('menuitem', { name: /Improve writing/ }))
    expect(onAi).toHaveBeenLastCalledWith({ action: 'improve', blockIds: ['t'] }, expect.any(AbortSignal))
  })
})

it('summarize puts its callout where the scope was', async () => {
  onAi = vi.fn().mockResolvedValue({
    action: 'summarize',
    blockIds: ['h', 't', 'c'],
    blocks: [{ id: 's', type: 'callout', tone: 'info', emoji: '📝', text: '**Summary:** Check first.' }, ...BLOCKS],
  })
  setup()
  await pick('Summarize')
  expect(within(await screen.findByRole('dialog', { name: 'Summary' })).getByRole('complementary')).toHaveTextContent('Summary: Check first.')
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
  expect(types()).toEqual(['callout', 'heading', 'text', 'code'])
})

it('moves the note to a folder from the header menu, keyboard included', async () => {
  setup({ folders: [{ id: 'f1', name: 'Work' }, { id: 'f2', name: 'Study' }], folderId: 'f1' })
  const button = screen.getByRole('button', { name: 'Move to folder (now: Work)' })
  button.focus()
  await userEvent.keyboard('{ArrowDown}')
  const menu = screen.getByRole('menu', { name: 'Folders to move this note to' })
  // The current folder is checked and gets the focus.
  expect(within(menu).getByRole('menuitemradio', { name: 'Work' })).toHaveFocus()
  expect(within(menu).getByRole('menuitemradio', { name: 'Work' })).toHaveAttribute('aria-checked', 'true')
  await userEvent.keyboard('{ArrowDown}{Enter}')
  expect(onMove).toHaveBeenCalledWith('f2')
  await userEvent.click(button)
  await userEvent.click(screen.getByRole('menuitemradio', { name: 'No folder' }))
  expect(onMove).toHaveBeenLastCalledWith(null)
})

it('speaks Brazilian Portuguese', async () => {
  setup({ locale: 'pt-BR' })
  await userEvent.click(screen.getByRole('button', { name: /IA/ }))
  const menu = screen.getByRole('menu', { name: 'Ferramentas de IA' })
  expect(within(menu).getAllByRole('menuitem').map((item) => item.querySelector('.font-semibold').textContent)).toEqual(['Melhorar texto', 'Organizar', 'Resumir'])
  await userEvent.click(within(menu).getByRole('menuitem', { name: /Melhorar texto/ }))
  const dialog = await screen.findByRole('dialog', { name: 'Texto melhorado' })
  expect(within(dialog).getByRole('button', { name: 'Aplicar' })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Descartar' })).toBeInTheDocument()
  expect(within(dialog).getByRole('tab', { name: 'Depois' })).toHaveAttribute('aria-selected', 'true')
  await userEvent.click(within(dialog).getByRole('tab', { name: 'Antes' }))
  expect(within(dialog).getByRole('tab', { name: 'Antes' })).toHaveAttribute('aria-selected', 'true')
  await act(async () => {
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aplicar' }))
  })
  expect(screen.getByText(/Mudanças da IA aplicadas/)).toBeInTheDocument()
})
