import { act, cleanup, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { loadEmojis } from '../../../lib/notes/emoji.js'
import NoteEditor from './note-editor.jsx'

const text = (id, value) => ({ id, type: 'text', text: value })
let onSave

function setup(blocks = [text('b1', '')], { locale = 'en' } = {}) {
  onSave = vi.fn().mockResolvedValue()
  return render(
    <I18nProvider locale={locale}>
      <MemoryRouter>
        <NoteEditor note={{ id: 'n1', title: 'Note', tags: [], blocks }} cases={[]} onSave={onSave} onDelete={vi.fn()} onExport={vi.fn()} />
      </MemoryRouter>
    </I18nProvider>,
  )
}

const types = () => [...document.querySelectorAll('[data-block]')].map((element) => element.dataset.block)
const box = (name) => screen.getByRole('textbox', { name })
const boxes = (name) => screen.getAllByRole('textbox', { name })
const values = (name) => boxes(name).map((field) => field.value)
// What the editor saves, once the autosave timer runs.
const lastSaved = async () => {
  await waitFor(() => expect(onSave).toHaveBeenCalled(), { timeout: 2000 })
  return onSave.mock.lastCall[0].blocks
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the "/" menu', () => {
  const commands = [
    ['code', 'code'],
    ['código', 'code'],
    ['linha', 'divider'],
    ['divisor', 'divider'],
    ['quote', 'quote'],
    ['citação', 'quote'],
    ['lista', 'bullet'],
    ['numerada', 'numbered'],
    ['callout', 'callout'],
    ['destaque', 'callout'],
    ['h2', 'heading'],
    ['tarefa', 'todo'],
  ]
  for (const [command, type] of commands) {
    it(`/${command} makes a ${type} block`, async () => {
      setup()
      await userEvent.type(box('Text'), `/${command}`)
      expect(screen.getByRole('listbox', { name: 'Turn into' })).toBeInTheDocument()
      await userEvent.keyboard('{Enter}')
      expect(types()[0]).toBe(type)
    })
  }

  it('filters as I type, with an icon per item, and the arrows pick', async () => {
    setup()
    await userEvent.type(box('Text'), '/')
    const all = within(screen.getByRole('listbox', { name: 'Turn into' })).getAllByRole('option')
    expect(all.map((option) => option.querySelector('.font-semibold').textContent)).toEqual([
      'Text',
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'To-do',
      'Bulleted list',
      'Numbered list',
      'Quote',
      'Code',
      'Divider',
      'Callout',
      'Case from your board',
      'Emoji',
    ])
    expect(all.every((option) => option.querySelector('[aria-hidden="true"]'))).toBe(true)
    await userEvent.type(box('Text'), 'he')
    expect(screen.getAllByRole('option').map((option) => option.querySelector('.font-semibold').textContent)).toEqual(['Heading 1', 'Heading 2', 'Heading 3'])
    expect(box('Text')).toHaveAttribute('aria-activedescendant', 'note-block-menu-0')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(box('Heading 3')).toHaveFocus()
    expect(box('Heading 3')).toHaveValue('')
  })

  it('says when nothing matches and Escape closes it', async () => {
    setup()
    await userEvent.type(box('Text'), '/zzz')
    expect(screen.getByText('No block matches that.')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(box('Text')).toHaveFocus()
  })

  it('/emoji opens the emoji picker', async () => {
    setup()
    await userEvent.type(box('Text'), '/emoji{Enter}')
    expect(await screen.findByRole('dialog', { name: 'Pick an emoji' })).toBeInTheDocument()
    expect(box('Text')).toHaveValue('')
  })
})

describe('"/" anywhere in the text', () => {
  // Puts the caret at index in the block, then types there.
  async function typeAt(field, index, keys) {
    await userEvent.click(field)
    field.setSelectionRange(index, index)
    await userEvent.keyboard(keys)
  }

  it('splits the paragraph: words before, the new block, words after, and one undo puts it back', async () => {
    setup([text('a', 'before after'), text('b', 'last')])
    await typeAt(boxes('Text')[0], 6, ' /código')
    expect(screen.getByRole('listbox', { name: 'Turn into' })).toBeInTheDocument()
    expect(boxes('Text')[0]).toHaveValue('before /código after')
    await userEvent.keyboard('{Enter}')
    expect(types()).toEqual(['text', 'code', 'text', 'text'])
    expect(values('Text')).toEqual(['before', 'after', 'last'])
    expect(box('Code')).toHaveFocus()
    expect(box('Code')).toHaveValue('')
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(types()).toEqual(['text', 'text'])
    expect(values('Text')).toEqual(['before /código after', 'last'])
  })

  it('works at the start of a line inside a paragraph of several lines', async () => {
    setup([text('a', 'line one\nline two')])
    await typeAt(box('Text'), 9, '/h2{Enter}')
    expect(types()).toEqual(['text', 'heading', 'text'])
    expect(values('Text')).toEqual(['line one', 'line two'])
    expect(box('Heading 2')).toHaveFocus()
    expect(await lastSaved()).toMatchObject([{ text: 'line one' }, { type: 'heading', level: 2, text: '' }, { text: 'line two' }])
  })

  it('a divider in the middle sends the caret on to the words after it', async () => {
    setup([text('a', 'up down')])
    await typeAt(box('Text'), 3, '/divisor{Enter}')
    expect(types()).toEqual(['text', 'divider', 'text'])
    expect(values('Text')).toEqual(['up', 'down'])
    expect(boxes('Text')[1]).toHaveFocus()
  })

  it('works in a quote too', async () => {
    setup([{ id: 'q', type: 'quote', text: 'said this' }])
    await typeAt(box('Quote'), 9, ' /lista{Enter}')
    expect(types()).toEqual(['quote', 'bullet'])
    expect(box('Quote')).toHaveValue('said this')
    expect(box('List item')).toHaveFocus()
  })

  it('leaves a "/" inside a word or a URL alone, and a space after "/" closes the menu', async () => {
    setup()
    await userEvent.type(box('Text'), 'and/or https://x.dev/a')
    expect(screen.queryByRole('listbox')).toBeNull()
    await userEvent.type(box('Text'), ' /')
    expect(screen.getByRole('listbox', { name: 'Turn into' })).toBeInTheDocument()
    await userEvent.type(box('Text'), ' ')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(box('Text')).toHaveValue('and/or https://x.dev/a / ')
  })

  it('Escape closes the menu and keeps the text as typed', async () => {
    setup([text('a', 'some words')])
    await typeAt(box('Text'), 4, ' /cod')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(types()).toEqual(['text'])
    expect(box('Text')).toHaveValue('some /cod words')
    expect(box('Text')).toHaveFocus()
  })

  it('moving the caret off the command closes the menu', async () => {
    setup([text('a', 'go ')])
    await typeAt(box('Text'), 3, '/co')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(box('Text')).toHaveValue('go /co')
  })
})

describe('the "+" beside a block', () => {
  it('adds an empty line below and opens the block menu on it', async () => {
    setup([text('a', 'first'), text('b', 'second')])
    await userEvent.click(screen.getAllByRole('button', { name: 'Add block below' })[0])
    expect(values('Text')).toEqual(['first', '', 'second'])
    const search = screen.getByRole('searchbox', { name: 'Search blocks' })
    expect(search).toHaveFocus()
    await userEvent.type(search, 'código{Enter}')
    expect(types()).toEqual(['text', 'code', 'text'])
    expect(box('Code')).toHaveFocus()
    // One step back takes the new block away.
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(types()).toEqual(['text', 'text', 'text'])
  })

  it('on an empty line opens the menu there instead of adding another', async () => {
    setup([text('a', 'first'), text('b', '')])
    await userEvent.click(screen.getAllByRole('button', { name: 'Add block below' })[1])
    expect(types()).toEqual(['text', 'text'])
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(boxes('Text')[1]).toHaveFocus()
  })
})

describe('moving a block anywhere', () => {
  // jsdom lays nothing out: give each row a 40px box, one under the other.
  function layOut() {
    for (const [index, row] of [...document.querySelectorAll('[data-block]')].entries()) {
      row.getBoundingClientRect = () => ({ top: index * 40, bottom: index * 40 + 40, height: 40, left: 0, right: 600, width: 600, x: 0, y: index * 40 })
    }
  }
  function transfer() {
    const data = {}
    return { types: [], setData: (type, value) => (data[type] = value), getData: (type) => data[type], setDragImage: vi.fn(), effectAllowed: '', dropEffect: '' }
  }
  const handles = () => screen.getAllByRole('button', { name: 'Block options' })
  const list = () => document.querySelector('[data-block]').parentElement
  // jsdom has no DragEvent, so the pointer's height is set on the event by hand.
  function dragAt(type, clientY, dataTransfer) {
    const event = createEvent[type](list(), { dataTransfer })
    Object.defineProperty(event, 'clientY', { value: clientY })
    fireEvent(list(), event)
  }

  it('drags a block by its handle into a gap, with a line where it lands, as one undo step', async () => {
    setup([text('a', 'one'), text('b', 'two'), { id: 'c', type: 'code', text: 'x = 1', language: 'python' }, text('d', 'four')])
    layOut()
    const dataTransfer = transfer()
    fireEvent.dragStart(handles()[2], { dataTransfer })
    expect(dataTransfer.setDragImage).toHaveBeenCalled()
    // Its own gaps draw no line.
    dragAt('dragOver', 100, dataTransfer)
    expect(document.querySelector('[data-drop-line]')).toBeNull()
    // The upper half of the second row: the gap above it.
    dragAt('dragOver', 45, dataTransfer)
    expect(document.querySelector('[data-drop-line]')).not.toBeNull()
    dragAt('drop', 45, dataTransfer)
    fireEvent.dragEnd(handles()[2], { dataTransfer })
    expect(types()).toEqual(['text', 'code', 'text', 'text'])
    expect(values('Text')).toEqual(['one', 'two', 'four'])
    expect(document.querySelector('[data-drop-line]')).toBeNull()
    expect(screen.getByText('Block moved to position 2 of 4.')).toBeInTheDocument()
    await userEvent.click(boxes('Text')[0])
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(types()).toEqual(['text', 'text', 'code', 'text'])
  })

  it('drags a case block to the end; a drag that ends outside the list changes nothing', async () => {
    setup([{ id: 'k', type: 'case', caseId: 'gone' }, text('a', 'one'), text('b', 'two')])
    layOut()
    let dataTransfer = transfer()
    fireEvent.dragStart(handles()[0], { dataTransfer })
    dragAt('dragOver', 500, dataTransfer)
    dragAt('drop', 500, dataTransfer)
    fireEvent.dragEnd(handles()[0], { dataTransfer })
    expect(types()).toEqual(['text', 'text', 'case'])
    dataTransfer = transfer()
    fireEvent.dragStart(handles()[0], { dataTransfer })
    dragAt('dragOver', 10, dataTransfer)
    fireEvent.dragEnd(handles()[0], { dataTransfer })
    expect(types()).toEqual(['text', 'text', 'case'])
    expect(document.querySelector('[data-drop-line]')).toBeNull()
  })

  it('a drop just above the list, on the title, puts the block at the top', () => {
    setup([text('a', 'one'), text('b', 'two')])
    layOut()
    const dataTransfer = transfer()
    const title = box('Note title')
    fireEvent.dragStart(handles()[1], { dataTransfer })
    for (const type of ['dragOver', 'drop']) {
      const event = createEvent[type](title, { dataTransfer })
      Object.defineProperty(event, 'clientY', { value: -30 })
      fireEvent(title, event)
      if (type === 'drop') expect(event.defaultPrevented).toBe(true)
    }
    expect(values('Text')).toEqual(['two', 'one'])
    expect(title).toHaveValue('Note')
  })

  it('on a phone, holding the handle picks the block up and the finger moves it', () => {
    vi.useFakeTimers()
    setup([text('a', 'one'), text('b', 'two'), text('c', 'three')])
    layOut()
    const pointer = (type, target, clientY) => {
      const event = createEvent[type](target, { pointerId: 1 })
      Object.defineProperties(event, { pointerType: { value: 'touch' }, pointerId: { value: 1 }, clientX: { value: 590 }, clientY: { value: clientY } })
      fireEvent(target, event)
    }
    // A quick swipe is a scroll: nothing gets picked up.
    pointer('pointerDown', handles()[2], 100)
    pointer('pointerMove', document, 60)
    act(() => vi.advanceTimersByTime(400))
    pointer('pointerUp', document, 60)
    expect(values('Text')).toEqual(['one', 'two', 'three'])
    // Held still, then moved up and let go.
    pointer('pointerDown', handles()[2], 100)
    act(() => vi.advanceTimersByTime(400))
    pointer('pointerMove', document, 10)
    pointer('pointerUp', document, 10)
    expect(values('Text')).toEqual(['three', 'one', 'two'])
    vi.useRealTimers()
  })

  it('"Move to..." in the handle menu lists every spot and moves the block there', async () => {
    setup([text('a', 'one'), text('b', 'two'), text('c', '**three** words')])
    await userEvent.click(handles()[2])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move to...' }))
    const menu = screen.getByRole('menu', { name: 'Move to...' })
    const names = within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent.replace(/[<>]/g, ''))
    // Not after "two": it already is.
    expect(names).toEqual(['Back', 'To the top', 'After: one', 'To the end'])
    expect(within(menu).getByRole('menuitem', { name: 'To the top' })).toHaveFocus()
    expect(within(menu).getByRole('menuitem', { name: 'To the end' })).toBeDisabled()
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'After: one' }))
    expect(values('Text')).toEqual(['one', '**three** words', 'two'])
    expect(boxes('Text')[1]).toHaveFocus()
    expect(screen.getByText('Block moved to position 2 of 3.')).toBeInTheDocument()
  })

  it('"Move to..." works from the keyboard, with a way back', async () => {
    setup([text('a', 'one'), text('b', 'two')])
    handles()[0].focus()
    await userEvent.keyboard('{Enter}')
    // "Move up" is off for the first block, so "Move down" has the focus.
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Move to...' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('menuitem', { name: 'To the end' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}{Enter}')
    expect(screen.getByRole('menuitem', { name: 'Move to...' })).toHaveFocus()
    await userEvent.keyboard('{Enter}{Enter}')
    expect(values('Text')).toEqual(['two', 'one'])
    expect(boxes('Text')[1]).toHaveFocus()
  })

  it('says where Alt+arrows moved the block', async () => {
    setup([text('a', 'one'), text('b', 'two')])
    await userEvent.click(boxes('Text')[1])
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
    expect(screen.getByText('Block moved to position 1 of 2.')).toBeInTheDocument()
  })
})

describe('markdown shortcuts at the start of a text block', () => {
  const cases = [
    ['# ', 'heading', 'Heading 1'],
    ['## ', 'heading', 'Heading 2'],
    ['### ', 'heading', 'Heading 3'],
    ['- ', 'bullet', 'List item'],
    ['* ', 'bullet', 'List item'],
    ['1. ', 'numbered', 'Numbered item'],
    ['[[] ', 'todo', 'To-do'],
    ['[[ ] ', 'todo', 'To-do'],
    ['> ', 'quote', 'Quote'],
  ]
  for (const [typed, type, label] of cases) {
    it(`"${typed.replace('[[', '[')}" makes a ${type}`, async () => {
      setup()
      await userEvent.type(box('Text'), `${typed}words`)
      expect(types()).toEqual([type])
      expect(box(label)).toHaveValue('words')
    })
  }

  it('``` with a language, then a space or Enter, makes a code block in that language', async () => {
    setup([text('a', ''), text('b', '')])
    await userEvent.type(boxes('Text')[0], '```js ')
    expect(types()[0]).toBe('code')
    expect(screen.getAllByRole('combobox', { name: 'Code language' })[0]).toHaveValue('javascript')
    await userEvent.type(box('Text'), '```py{Enter}')
    expect(types()).toEqual(['code', 'code'])
    expect(screen.getAllByRole('combobox', { name: 'Code language' })[1]).toHaveValue('python')
  })

  it('--- makes a divider and moves on to a new line', async () => {
    setup()
    await userEvent.type(box('Text'), '---')
    expect(types()).toEqual(['divider', 'text'])
    expect(box('Text')).toHaveFocus()
  })

  it('leaves the same text alone in the middle of a line', async () => {
    setup()
    await userEvent.type(box('Text'), 'a - b # c')
    expect(types()).toEqual(['text'])
  })

  it('undoes a shortcut back to the typed text', async () => {
    setup()
    await userEvent.type(box('Text'), '# ')
    expect(types()).toEqual(['heading'])
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(types()).toEqual(['text'])
    expect(box('Text')).toHaveValue('#')
  })
})

describe('inline marks', () => {
  it('draws bold, italic, code, strike and safe links when not typing', async () => {
    const { container } = setup([text('a', '**bold** *it* `code` ~~gone~~ [MDN](https://developer.mozilla.org) [bad](javascript:alert(1))'), text('b', 'plain')])
    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByText('it').tagName).toBe('EM')
    expect(screen.getByText('code').tagName).toBe('CODE')
    expect(screen.getByText('gone').tagName).toBe('S')
    const link = screen.getByRole('link', { name: 'MDN' })
    expect(link).toHaveAttribute('href', 'https://developer.mozilla.org/')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    expect(link).toHaveAttribute('target', '_blank')
    expect(container.querySelector('a[href^="javascript"]')).toBeNull()
    expect(screen.queryByRole('link', { name: 'bad' })).toBeNull()

    // A click on the drawing goes back to the markdown as typed.
    fireEvent.mouseDown(screen.getByText('bold'))
    await waitFor(() => expect(boxes('Text')[0]).toHaveFocus())
    expect(screen.queryByText('bold', { selector: 'strong' })).toBeNull()
  })
})

describe('lists', () => {
  it('Tab nests an item, Shift+Tab takes it back, Enter continues and an empty Enter leaves', async () => {
    setup([{ id: 'l1', type: 'bullet', text: 'one' }])
    await userEvent.click(box('List item'))
    await userEvent.keyboard('{Enter}two{Tab}')
    const rows = () => [...document.querySelectorAll('[data-indent]')].map((row) => row.dataset.indent)
    expect(values('List item')).toEqual(['one', 'two'])
    expect(rows()).toEqual(['0', '1'])
    // Enter keeps the nesting.
    await userEvent.keyboard('{Enter}three')
    expect(rows()).toEqual(['0', '1', '1'])
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    expect(rows()).toEqual(['0', '1', '0'])
    await userEvent.keyboard('{Enter}{Enter}')
    expect(types()).toEqual(['bullet', 'bullet', 'bullet', 'text'])
    expect(box('Text')).toHaveFocus()
    expect(await lastSaved()).toMatchObject([{ text: 'one' }, { text: 'two', indent: 1 }, { text: 'three' }, { type: 'text', text: '' }])
  })

  it('numbers the items of a numbered list', async () => {
    setup([
      { id: 'a', type: 'numbered', text: 'a' },
      { id: 'b', type: 'numbered', text: 'b' },
      { id: 'c', type: 'numbered', text: 'c', indent: 1 },
    ])
    expect([...document.querySelectorAll('[data-indent] > span')].map((span) => span.textContent)).toEqual(['1.', '2.', '1.'])
  })
})

describe('code blocks', () => {
  it('keeps the indentation, picks a language and copies', async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    setup([{ id: 'c', type: 'code', text: '', language: '' }])
    const code = box('Code')
    await userEvent.type(code, '  a{Enter}b')
    expect(code).toHaveValue('  a\n  b')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Code language' }), 'python')
    await userEvent.click(screen.getByRole('button', { name: 'Copy the code' }))
    expect(writeText).toHaveBeenCalledWith('  a\n  b')
    expect(await screen.findByText('Copied')).toBeInTheDocument()
    expect(await lastSaved()).toEqual([{ id: 'c', type: 'code', text: '  a\n  b', language: 'python' }])
    vi.unstubAllGlobals()
  })

  it('Tab indents in code, Ctrl+/ comments in its language, Ctrl+Enter leaves for a new block', async () => {
    setup([{ id: 'c', type: 'code', text: 'x = 1', language: 'python' }])
    const code = box('Code')
    await userEvent.click(code)
    await userEvent.keyboard('{Control>}/{/Control}')
    expect(code).toHaveValue('# x = 1')
    expect(screen.queryByRole('listbox')).toBeNull()
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(types()).toEqual(['code', 'text'])
    expect(box('Text')).toHaveFocus()
  })
})

describe('emojis', () => {
  beforeEach(async () => {
    await loadEmojis()
  })

  it('finds an emoji by Portuguese or English words and puts it where I was writing', async () => {
    setup([text('a', 'Hot ')])
    await userEvent.click(box('Text'))
    await userEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    const search = await screen.findByRole('combobox', { name: 'Search emojis' })
    expect(search).toHaveFocus()
    await userEvent.type(search, 'fogo')
    expect(document.getElementById(search.getAttribute('aria-activedescendant'))).toHaveTextContent('🔥')
    await userEvent.clear(search)
    await userEvent.type(search, 'fire')
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('🔥')
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(box('Text')).toHaveValue('Hot 🔥')
  })

  it('moves through the grid with the arrows, shows categories and remembers what I used', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    const search = await screen.findByRole('combobox', { name: 'Search emojis' })
    expect(screen.getByRole('button', { name: 'Smileys' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Food' }))
    expect(screen.getByRole('listbox', { name: 'Food' })).toBeInTheDocument()
    await userEvent.click(search)
    await userEvent.keyboard('{ArrowRight}{ArrowDown}')
    // Seven to a row: right once, down once is the ninth.
    expect(search.getAttribute('aria-activedescendant')).toBe('note-emoji-picker-list-8')
    await userEvent.keyboard('{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    expect(await screen.findByRole('button', { name: 'Recent' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })

  it('works when the browser blocks storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    await userEvent.type(await screen.findByRole('combobox', { name: 'Search emojis' }), 'rocket{Enter}')
    expect(box('Text')).toHaveValue('🚀')
  })

  it('Escape closes the picker and gives focus back', async () => {
    setup()
    const button = screen.getByRole('button', { name: 'Emoji' })
    await userEvent.click(button)
    await screen.findByRole('dialog', { name: 'Pick an emoji' })
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(button).toHaveFocus()
  })

  it('":" and two letters suggest emojis to complete', async () => {
    setup()
    await userEvent.type(box('Text'), 'hot :f')
    expect(screen.queryByRole('listbox')).toBeNull()
    await userEvent.type(box('Text'), 'ogo')
    const list = await screen.findByRole('listbox', { name: 'Emojis' })
    expect(within(list).getAllByRole('option')[0]).toHaveTextContent('🔥:fire:')
    await userEvent.keyboard('{Enter}')
    expect(box('Text')).toHaveValue('hot 🔥')
    // A time or a URL is not an emoji.
    await userEvent.type(box('Text'), ' 10:30 https://x.dev')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('changes the emoji and the style of a callout', async () => {
    setup([{ id: 'o', type: 'callout', text: 'Careful', tone: 'tip', emoji: '💡' }])
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Callout style' }), 'warning')
    // The default emoji follows the style.
    await userEvent.click(screen.getByRole('button', { name: 'Change the emoji (⚠️)' }))
    await userEvent.type(await screen.findByRole('combobox', { name: 'Search emojis' }), 'rocket{Enter}')
    expect(await lastSaved()).toEqual([{ id: 'o', type: 'callout', text: 'Careful', tone: 'warning', emoji: '🚀' }])
  })
})

describe('IDE keys', () => {
  it('Tab indents prose with two spaces and never leaves; Shift+Tab undoes it', async () => {
    setup([text('a', 'line')])
    const field = box('Text')
    await userEvent.click(field)
    field.setSelectionRange(0, 0)
    await userEvent.keyboard('{Tab}')
    expect(field).toHaveValue('  line')
    expect(field).toHaveFocus()
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    expect(field).toHaveValue('line')
    expect(field).toHaveFocus()
  })

  it('Esc then Tab leaves the editor', async () => {
    setup([text('a', 'line')])
    await userEvent.click(box('Text'))
    await userEvent.keyboard('{Escape}')
    await userEvent.tab()
    expect(box('Text')).not.toHaveFocus()
  })

  it('Enter and Shift+Enter break the line in text, never make a new block', async () => {
    setup([text('a', 'onetwo')])
    const field = box('Text')
    await userEvent.click(field)
    field.setSelectionRange(3, 3)
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    expect(field).toHaveValue('one\ntwo')
    await userEvent.keyboard('{Enter}')
    expect(field).toHaveValue('one\n\ntwo')
    expect(boxes('Text')).toHaveLength(1)
  })

  it('a quote takes line breaks, and Enter on an empty quote leaves it', async () => {
    setup([{ id: 'q', type: 'quote', text: '' }])
    await userEvent.click(box('Quote'))
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByRole('textbox', { name: 'Quote' })).toBeNull()
    expect(boxes('Text')).toHaveLength(1)
  })

  it('typed words that start like a shortcut stay text; only an empty block converts', async () => {
    setup([text('a', 'notes')])
    const field = box('Text')
    await userEvent.click(field)
    field.setSelectionRange(0, 0)
    await userEvent.keyboard('- ')
    expect(box('Text')).toHaveValue('- notes')
  })

  it('Enter on a to-do starts another; Ctrl+Enter checks it', async () => {
    setup([{ id: 't', type: 'todo', text: 'first', done: false }])
    await userEvent.click(box('To-do'))
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(screen.getByRole('checkbox', { name: 'Done: first' })).toBeChecked()
    await userEvent.keyboard('{Enter}second')
    expect(values('To-do')).toEqual(['first', 'second'])
  })

  it('Ctrl+Enter adds a block below, Ctrl+Shift+Enter above', async () => {
    setup([text('a', 'middle')])
    await userEvent.click(box('Text'))
    await userEvent.keyboard('{Control>}{Enter}{/Control}below')
    await userEvent.click(boxes('Text')[0])
    await userEvent.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}above')
    expect(values('Text')).toEqual(['above', 'middle', 'below'])
  })

  it('Alt+Up and Alt+Down move the block, Ctrl+D duplicates it', async () => {
    setup([text('a', 'one'), text('b', 'two')])
    await userEvent.click(boxes('Text')[1])
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
    expect(values('Text')).toEqual(['two', 'one'])
    expect(boxes('Text')[0]).toHaveFocus()
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(values('Text')).toEqual(['one', 'two'])
    await userEvent.keyboard('{Control>}d{/Control}')
    expect(values('Text')).toEqual(['one', 'two', 'two'])
    expect(boxes('Text')[2]).toHaveFocus()
  })

  it('Ctrl+Shift+K deletes the block, and Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y undo and redo it', async () => {
    setup([text('a', 'keep'), text('b', 'precious words')])
    await userEvent.click(boxes('Text')[1])
    await userEvent.keyboard('{Control>}{Shift>}k{/Shift}{/Control}')
    expect(values('Text')).toEqual(['keep'])
    expect(screen.getByText(/Block deleted\./)).toBeInTheDocument()
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(values('Text')).toEqual(['keep', 'precious words'])
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(values('Text')).toEqual(['keep'])
    await userEvent.keyboard('{Control>}z{/Control}{Control>}y{/Control}')
    expect(values('Text')).toEqual(['keep'])
  })

  it('undoes typing a step at a time, across blocks', async () => {
    setup([text('a', '')])
    await userEvent.type(box('Text'), 'hello{Control>}{Enter}{/Control}world')
    expect(values('Text')).toEqual(['hello', 'world'])
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(values('Text')).toEqual(['hello', ''])
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(values('Text')).toEqual(['hello'])
  })

  it('Ctrl+/ opens the block menu with a search box; Escape gives focus back', async () => {
    setup([text('a', 'keep me')])
    await userEvent.click(box('Text'))
    await userEvent.keyboard('{Control>}/{/Control}')
    const search = screen.getByRole('searchbox', { name: 'Search blocks' })
    expect(search).toHaveFocus()
    await userEvent.type(search, 'citação')
    await userEvent.keyboard('{Enter}')
    // The block changes kind and keeps its words.
    expect(box('Quote')).toHaveValue('keep me')
    await userEvent.keyboard('{Control>}/{/Control}{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(box('Quote')).toHaveFocus()
  })

  it('Ctrl+B, I, E and K put marks around the selection', async () => {
    setup([text('a', 'word')])
    const field = box('Text')
    const mark = async (keys) => {
      await userEvent.click(field)
      field.setSelectionRange(0, 4)
      await userEvent.keyboard(keys)
    }
    await mark('{Control>}b{/Control}')
    expect(field).toHaveValue('**word**')
    await userEvent.keyboard('{Control>}z{/Control}')
    await mark('{Control>}i{/Control}')
    expect(field).toHaveValue('*word*')
    await userEvent.keyboard('{Control>}z{/Control}')
    await mark('{Control>}e{/Control}')
    expect(field).toHaveValue('`word`')
    await userEvent.keyboard('{Control>}z{/Control}')
    await mark('{Control>}k{/Control}')
    expect(field).toHaveValue('[word](https://)')
    // The URL is selected, ready to paste over.
    expect(field.value.slice(field.selectionStart, field.selectionEnd)).toBe('https://')
  })

  it('keeps its keys away while a menu is open or a word is being composed', async () => {
    setup([text('a', '')])
    await userEvent.type(box('Text'), '/co')
    await userEvent.keyboard('{Control>}d{/Control}')
    expect(types()).toEqual(['text'])
    await userEvent.keyboard('{Escape}')
    fireEvent.keyDown(box('Text'), { key: 'Enter', isComposing: true })
    expect(types()).toEqual(['text'])
  })
})

describe('deleting blocks', () => {
  it('has no one-click way to empty the note: every button keeps the writing', async () => {
    setup([
      { id: 'h', type: 'heading', text: 'Title words' },
      text('t', 'Body words'),
      { id: 'd', type: 'todo', text: 'Todo words', done: false },
      { id: 'c', type: 'code', text: 'code words', language: '' },
      { id: 'o', type: 'callout', text: 'Callout words', tone: 'tip', emoji: '💡' },
      { id: 'l', type: 'bullet', text: 'List words' },
    ])
    const writing = () => ['Title words', 'Body words', 'Todo words', 'code words', 'Callout words', 'List words'].every((words) => screen.getAllByDisplayValue(words).length > 0)
    expect(screen.queryByRole('button', { name: 'Remove this block' })).toBeNull()
    const content = [...document.querySelectorAll('[data-block]')]
    const buttons = content.flatMap((block) => [...block.querySelectorAll('button')])
    expect(buttons.length).toBeGreaterThan(6)
    for (const button of buttons) {
      if (!button.isConnected) continue
      await userEvent.click(button)
      expect(writing(), button.getAttribute('aria-label') ?? button.textContent).toBe(true)
      await userEvent.keyboard('{Escape}')
    }
  })

  it('deletes from the block menu, says so, and Undo brings it back', async () => {
    setup([text('a', 'first'), text('b', 'second')])
    const [, handle] = screen.getAllByRole('button', { name: 'Block options' })
    await userEvent.click(handle)
    const menu = screen.getByRole('menu', { name: 'Block options' })
    expect(within(menu).getByRole('menuitem', { name: 'Move up' })).toHaveFocus()
    expect(within(menu).getByRole('menuitem', { name: 'Move down' })).toBeDisabled()
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Delete block' }))
    expect(values('Text')).toEqual(['first'])
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(values('Text')).toEqual(['first', 'second'])
  })

  it('Escape closes the block menu and focus goes back to its button', async () => {
    setup([text('a', 'first')])
    const handle = screen.getByRole('button', { name: 'Block options' })
    await userEvent.click(handle)
    await userEvent.keyboard('{ArrowDown}{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(handle).toHaveFocus()
  })
})

it('speaks Brazilian Portuguese', async () => {
  await loadEmojis()
  setup([text('a', '')], { locale: 'pt-BR' })
  await userEvent.type(screen.getByRole('textbox', { name: 'Texto' }), '/')
  const names = within(screen.getByRole('listbox', { name: 'Transformar em' }))
    .getAllByRole('option')
    .map((option) => option.querySelector('.font-semibold').textContent)
  expect(names).toEqual(['Texto', 'Título 1', 'Título 2', 'Título 3', 'Tarefa', 'Lista com marcadores', 'Lista numerada', 'Citação', 'Código', 'Divisor', 'Destaque', 'Caso do seu board', 'Emoji'])
  await userEvent.keyboard('{Escape}')
  expect(screen.getAllByRole('button', { name: 'Opções do bloco' })).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: 'Adicionar bloco abaixo' })).toHaveLength(1)
  expect(screen.getByText((_, node) => node?.tagName === 'P' && node.textContent === 'Digite / em qualquer lugar para inserir um bloco e @ para trazer um caso do seu board.')).toBeInTheDocument()
  expect(screen.getByText('Inserir um bloco em qualquer lugar do texto (a palavra depois filtra)')).toBeInTheDocument()
  expect(screen.getByText('Atalhos')).toBeInTheDocument()
  expect(screen.getByRole('list', { name: 'Atalhos da nota', hidden: true })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Texto' })).toHaveAccessibleDescription('Aqui o Tab indenta. Aperte Esc e depois Tab para sair da nota.')
  await userEvent.click(screen.getByRole('button', { name: 'Emoji' }))
  expect(await screen.findByRole('dialog', { name: 'Escolha um emoji' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Buscar emojis' })).toHaveAttribute('placeholder', 'Ex.: fogo, fire')
  await act(async () => {
    await userEvent.keyboard('{Escape}')
  })
  cleanup()
})
