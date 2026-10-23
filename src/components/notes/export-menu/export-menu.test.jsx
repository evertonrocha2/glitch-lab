import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import ExportMenu from './export-menu.jsx'

it('offers the formats in Brazilian Portuguese', async () => {
  render(
    <I18nProvider locale="pt-BR">
      <ExportMenu onExport={vi.fn()} />
    </I18nProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
  expect(screen.getByRole('menu', { name: 'Exportar como' })).toBeInTheDocument()
  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Markdown.md', 'Imagem.png', 'PDF.pdf'])
  expect(screen.getByText('Baixar como')).toBeInTheDocument()
})

it('opens a menu with the three formats', async () => {
  render(<ExportMenu onExport={vi.fn()} />)
  const button = screen.getByRole('button', { name: 'Export' })
  expect(button).toHaveAttribute('aria-haspopup', 'menu')
  expect(button).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  const items = screen.getAllByRole('menuitem')
  expect(items.map((item) => item.textContent)).toEqual(['Markdown.md', 'Image.png', 'PDF.pdf'])
  // Focus moves into the menu so the keyboard can pick.
  expect(items[0]).toHaveFocus()
})

it.each([
  ['Markdown', 'md'],
  ['Image', 'png'],
  ['PDF', 'pdf'],
])('picking %s exports %s and closes the menu', async (label, format) => {
  const onExport = vi.fn().mockResolvedValue()
  render(<ExportMenu onExport={onExport} />)
  await userEvent.click(screen.getByRole('button', { name: 'Export' }))
  await userEvent.click(screen.getByRole('menuitem', { name: new RegExp(label) }))
  expect(onExport).toHaveBeenCalledWith(format)
  expect(screen.queryByRole('menu')).toBeNull()
  expect(screen.getByRole('button', { name: 'Export' })).toHaveFocus()
})

it('moves with the arrow keys, wraps around, and closes on Escape', async () => {
  render(<ExportMenu onExport={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Export' }))
  const items = screen.getAllByRole('menuitem')
  await userEvent.keyboard('{ArrowDown}')
  expect(items[1]).toHaveFocus()
  await userEvent.keyboard('{ArrowUp}{ArrowUp}')
  expect(items[2]).toHaveFocus()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).toBeNull()
  expect(screen.getByRole('button', { name: 'Export' })).toHaveFocus()
})

it('picks with Enter from the keyboard', async () => {
  const onExport = vi.fn().mockResolvedValue()
  render(<ExportMenu onExport={onExport} />)
  screen.getByRole('button', { name: 'Export' }).focus()
  await userEvent.keyboard('{Enter}')
  await userEvent.keyboard('{End}{Enter}')
  expect(onExport).toHaveBeenCalledWith('pdf')
})

it('closes when I click somewhere else', async () => {
  render(
    <>
      <ExportMenu onExport={vi.fn()} />
      <p>Elsewhere</p>
    </>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Export' }))
  await userEvent.click(screen.getByText('Elsewhere'))
  expect(screen.queryByRole('menu')).toBeNull()
})

it('says it is busy while a file is being made', async () => {
  let finish
  const onExport = vi.fn(() => new Promise((resolve) => (finish = resolve)))
  render(<ExportMenu onExport={onExport} />)
  await userEvent.click(screen.getByRole('button', { name: 'Export' }))
  await userEvent.click(screen.getByRole('menuitem', { name: /PDF/ }))
  const busy = screen.getByRole('button', { name: 'Exporting...' })
  expect(busy).toHaveAttribute('aria-disabled', 'true')
  // A second click while busy does nothing.
  await userEvent.click(busy)
  expect(screen.queryByRole('menu')).toBeNull()
  finish()
  expect(await screen.findByRole('button', { name: 'Export' })).not.toHaveAttribute('aria-disabled')
})
