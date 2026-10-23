import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import CodeEditor from './code-editor.jsx'

function Editor({ initial = '', language, readOnly, onChange = () => {} }) {
  const [code, setCode] = useState(initial)
  return (
    <>
      <label htmlFor="code">Code</label>
      <CodeEditor
        id="code"
        value={code}
        onChange={(next) => {
          setCode(next)
          onChange(next)
        }}
        language={language}
        readOnly={readOnly}
      />
    </>
  )
}

const box = () => screen.getByLabelText('Code')

// Puts the caret (or a selection) in the editor without typing.
function select(start, end = start) {
  box().focus()
  box().setSelectionRange(start, end)
}

afterEach(() => {
  delete document.execCommand
})

it('types code with the brackets closing and the indent kept', async () => {
  render(<Editor />)
  await userEvent.type(box(), 'if (ok) {{{Enter}go()')
  expect(box()).toHaveValue('if (ok) {\n  go()\n}')
})

it('Tab indents and Shift+Tab outdents, without leaving the editor', async () => {
  render(<Editor initial={'a\nb'} />)
  select(0, 3)
  await userEvent.keyboard('{Tab}')
  expect(box()).toHaveValue('  a\n  b')
  expect(box()).toHaveFocus()
  expect([box().selectionStart, box().selectionEnd]).toEqual([0, 7])
  await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
  expect(box()).toHaveValue('a\nb')
})

it('Esc then Tab leaves the editor', async () => {
  render(<Editor initial="x" />)
  select(1)
  await userEvent.keyboard('{Escape}{Tab}')
  expect(box()).not.toHaveFocus()
  expect(screen.getByText('Shortcuts')).toHaveFocus()
  expect(box()).toHaveValue('x')
})

it('Ctrl+Enter adds a line below and Ctrl+Shift+Enter one above', async () => {
  render(<Editor initial={'  one\ntwo'} />)
  select(2)
  await userEvent.keyboard('{Control>}{Enter}{/Control}x')
  expect(box()).toHaveValue('  one\n  x\ntwo')
  await userEvent.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}y')
  expect(box()).toHaveValue('  one\n  y\n  x\ntwo')
})

it('Ctrl+/ comments with the language token and does not reach the page', async () => {
  const outside = vi.fn()
  document.addEventListener('keydown', outside)
  render(<Editor initial="print(x)" language="python" />)
  select(3)
  await userEvent.keyboard('{Control>}/{/Control}')
  expect(box()).toHaveValue('# print(x)')
  expect(outside.mock.lastCall[0].defaultPrevented).toBe(true)
  await userEvent.keyboard('{Meta>}/{/Meta}')
  expect(box()).toHaveValue('print(x)')
  document.removeEventListener('keydown', outside)
})

it('Alt+Up and Alt+Down move lines, Shift+Alt copies them', async () => {
  render(<Editor initial={'a\nb\nc'} />)
  select(2)
  await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
  expect(box()).toHaveValue('b\na\nc')
  await userEvent.keyboard('{Alt>}{ArrowDown}{ArrowDown}{/Alt}')
  expect(box()).toHaveValue('a\nc\nb')
  await userEvent.keyboard('{Shift>}{Alt>}{ArrowUp}{/Alt}{/Shift}')
  expect(box()).toHaveValue('a\nc\nb\nb')
})

it('Ctrl+Shift+K deletes the line', async () => {
  render(<Editor initial={'keep\ndrop\nkeep too'} />)
  select(6)
  await userEvent.keyboard('{Control>}{Shift>}K{/Shift}{/Control}')
  expect(box()).toHaveValue('keep\nkeep too')
})

it('steps over a typed closer and Backspace clears an empty pair', async () => {
  render(<Editor />)
  await userEvent.type(box(), 'f("a")')
  expect(box()).toHaveValue('f("a")')
  await userEvent.type(box(), '{End}[[{Backspace}')
  expect(box()).toHaveValue('f("a")')
})

it('goes through execCommand, one small insert, so Ctrl+Z can undo it', async () => {
  const calls = []
  document.execCommand = vi.fn((command, _ui, text = '') => {
    const target = document.activeElement
    calls.push({ command, text, range: [target.selectionStart, target.selectionEnd] })
    target.setRangeText(command === 'delete' ? '' : text, target.selectionStart, target.selectionEnd, 'end')
    target.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })
  const onChange = vi.fn()
  render(<Editor initial={'a\nb'} onChange={onChange} />)
  select(0, 3)
  await userEvent.keyboard('{Control>}/{/Control}')
  expect(box()).toHaveValue('// a\n// b')
  // Both lines change, so the one insert covers just the span between them.
  expect(calls).toEqual([{ command: 'insertText', text: '// a\n// ', range: [0, 2] }])
  expect(onChange).toHaveBeenLastCalledWith('// a\n// b')
  await userEvent.keyboard('{Control>}{Shift>}K{/Shift}{/Control}')
  expect(calls.at(-1)).toEqual({ command: 'delete', text: '', range: [0, 9] })
  expect(box()).toHaveValue('')
})

it('leaves a read-only editor alone and hides its shortcut list', async () => {
  render(<Editor initial="done" readOnly />)
  select(4)
  await userEvent.keyboard('{Control>}/{/Control}')
  expect(box()).toHaveValue('done')
  expect(screen.queryByText('Shortcuts')).toBeNull()
})

it('lists the shortcuts, in Portuguese too, with Cmd on a Mac', async () => {
  const { unmount } = render(<Editor />)
  await userEvent.click(screen.getByText('Shortcuts'))
  const list = screen.getByRole('list', { name: 'Editor shortcuts' })
  expect(within(list).getByText('Comment or uncomment')).toBeInTheDocument()
  expect(within(list).getAllByText('Ctrl').length).toBeGreaterThan(0)
  expect(box()).toHaveAccessibleDescription('Tab indents here. Press Esc, then Tab, to leave the editor.')
  unmount()

  const platform = vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
  render(
    <I18nProvider locale="pt-BR">
      <Editor />
    </I18nProvider>,
  )
  await userEvent.click(screen.getByText('Atalhos'))
  const pt = screen.getByRole('list', { name: 'Atalhos do editor' })
  expect(within(pt).getByText('Mover a linha')).toBeInTheDocument()
  expect(within(pt).getAllByText('Cmd').length).toBeGreaterThan(0)
  expect(within(pt).getAllByText('Option').length).toBeGreaterThan(0)
  expect(within(pt).queryByText('Ctrl')).toBeNull()
  platform.mockRestore()
})
