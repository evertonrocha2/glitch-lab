import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import TagInput from './tag-input.jsx'

// The editor owns the list; this stands in for it and reports every change.
function Harness({ start = [], suggestions = [], onChange = () => {} }) {
  const [tags, setTags] = useState(start)
  return (
    <TagInput
      tags={tags}
      suggestions={suggestions}
      onChange={(next) => {
        setTags(next)
        onChange(next)
      }}
    />
  )
}

const field = () => screen.getByRole('combobox', { name: 'Tags' })
const chips = () => {
  const list = screen.queryByRole('list', { name: 'Note tags' })
  return list ? within(list).getAllByRole('listitem').map((item) => item.firstChild.textContent) : []
}

it('turns text into chips on Enter, comma and leaving the field', async () => {
  render(<Harness />)
  expect(field()).toHaveAttribute('placeholder', 'e.g. javascript, loops')
  await userEvent.type(field(), '  JavaScript {Enter}Laço  de repetição,')
  expect(chips()).toEqual(['#javascript', '#laço de repetição'])
  expect(field()).toHaveValue('')
  await userEvent.type(field(), 'c#')
  await userEvent.tab()
  expect(chips()).toEqual(['#javascript', '#laço de repetição', '#c#'])
})

it('adds every finished word when a list is pasted', async () => {
  render(<Harness />)
  await userEvent.click(field())
  await userEvent.paste('loops, arrays, c++, half')
  expect(chips()).toEqual(['#loops', '#arrays', '#c++'])
  expect(field()).toHaveValue('half')
})

it('removes the last chip with Backspace on an empty field, and any chip with its button', async () => {
  const onChange = vi.fn()
  render(<Harness start={['loops', 'arrays', 'c++']} onChange={onChange} />)
  await userEvent.click(field())
  await userEvent.keyboard('{Backspace}')
  expect(chips()).toEqual(['#loops', '#arrays'])
  await userEvent.click(screen.getByRole('button', { name: 'Remove tag loops' }))
  expect(chips()).toEqual(['#arrays'])
  expect(onChange).toHaveBeenLastCalledWith(['arrays'])
  // The keyboard stays in the field after the chip's button goes away.
  expect(field()).toHaveFocus()
})

it('ignores a tag it already has, in any case', async () => {
  const onChange = vi.fn()
  render(<Harness start={['loops']} onChange={onChange} />)
  await userEvent.type(field(), 'LOOPS{Enter}')
  expect(chips()).toEqual(['#loops'])
  expect(onChange).not.toHaveBeenCalled()
  expect(field()).toHaveValue('')
})

it('stops at 8 tags and says why', async () => {
  render(<Harness start={['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']} />)
  await userEvent.type(field(), 'a8{Enter}a9{Enter}')
  expect(chips()).toHaveLength(8)
  expect(screen.getByText('Use up to 8 tags.')).toBeInTheDocument()
  // What couldn't be added stays in the field.
  expect(field()).toHaveValue('a9')
})

it('keeps a tag it can not take in the field, with the reason', async () => {
  render(<Harness />)
  await userEvent.type(field(), 'a/b{Enter}')
  expect(chips()).toEqual([])
  expect(field()).toHaveValue('a/b')
  expect(field()).toHaveAccessibleDescription('Use letters, numbers, spaces and - . # +')
  await userEvent.clear(field())
  await userEvent.type(field(), `${'x'.repeat(25)}{Enter}`)
  expect(screen.getByText('Keep each tag up to 24 characters.')).toBeInTheDocument()
})

it('suggests my other tags and picks one with the arrow keys', async () => {
  render(<Harness start={['javascript']} suggestions={['javascript', 'loops', 'laço', 'lists', 'python']} />)
  await userEvent.type(field(), 'l')
  const listbox = screen.getByRole('listbox', { name: 'Your tags' })
  // Tags already on the note are not offered again.
  expect(within(listbox).getAllByRole('option').map((option) => option.textContent)).toEqual(['#loops', '#laço', '#lists'])
  expect(field()).toHaveAttribute('aria-expanded', 'true')
  expect(field()).not.toHaveAttribute('aria-activedescendant')

  await userEvent.keyboard('{ArrowDown}{ArrowDown}')
  const active = document.getElementById(field().getAttribute('aria-activedescendant'))
  expect(active).toHaveTextContent('#laço')
  expect(active).toHaveAttribute('aria-selected', 'true')
  await userEvent.keyboard('{ArrowUp}{ArrowUp}')
  // Up from the first wraps to the last.
  expect(document.getElementById(field().getAttribute('aria-activedescendant'))).toHaveTextContent('#lists')
  await userEvent.keyboard('{Enter}')
  expect(chips()).toEqual(['#javascript', '#lists'])
  expect(screen.queryByRole('listbox')).toBeNull()
})

it('adds the typed text on Enter when no suggestion was picked, and Escape closes the list', async () => {
  render(<Harness suggestions={['loops']} />)
  await userEvent.type(field(), 'loo')
  expect(screen.getByRole('listbox')).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('listbox')).toBeNull()
  await userEvent.keyboard('{Enter}')
  expect(chips()).toEqual(['#loo'])
})

it('picks a suggestion with the mouse', async () => {
  render(<Harness suggestions={['loops']} />)
  await userEvent.type(field(), 'oop')
  await userEvent.click(screen.getByRole('option', { name: '#loops' }))
  expect(chips()).toEqual(['#loops'])
})

it('speaks Brazilian Portuguese', async () => {
  render(
    <I18nProvider locale="pt-BR">
      <Harness start={['loops']} />
    </I18nProvider>,
  )
  const input = screen.getByRole('combobox', { name: 'Tags' })
  expect(screen.getByRole('list', { name: 'Tags da nota' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Remover tag loops' })).toBeInTheDocument()
  expect(input).toHaveAccessibleDescription('Enter ou vírgula adiciona a tag. Até 8.')
  await userEvent.click(screen.getByRole('button', { name: 'Remover tag loops' }))
  expect(input).toHaveAttribute('placeholder', 'Ex.: javascript, loops')
  await userEvent.type(input, 'a/b{Enter}')
  expect(screen.getByText('Use letras, números, espaços e - . # +')).toBeInTheDocument()
})
