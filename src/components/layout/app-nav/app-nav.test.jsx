import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import AppNav, { fitCount, NAV_ITEMS } from './app-nav.jsx'

it('fits every link when they all fit, even without room for the More button', () => {
  expect(fitCount([50, 50, 50], 170, 40, 10)).toBe(3)
  expect(fitCount([50, 50, 50], 169, 40, 10)).toBe(2)
})

it('keeps room for the More button after the links that fit', () => {
  // 40 (More) + 50+10 + 50+10 = 160: two links fit in 160, only one in 159.
  expect(fitCount([50, 50, 50, 50], 160, 40, 10)).toBe(2)
  expect(fitCount([50, 50, 50, 50], 159, 40, 10)).toBe(1)
  expect(fitCount([50, 50, 50, 50], 30, 40, 10)).toBe(0)
  expect(fitCount([], 0, 40, 10)).toBe(0)
})

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>
}

function renderNav({ path = '/board', unread = 0, rowWidth = 10_000 } = {}) {
  // happy-dom has no layout: every link is 100px, the More button 60px, the row rowWidth px.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
    const width = this.tagName === 'NAV' ? rowWidth : this.hasAttribute('data-nav-item') ? 100 : 60
    return { width, height: 20, top: 0, left: 0, right: width, bottom: 20, x: 0, y: 0 }
  })
  return render(
    <I18nProvider locale="en">
      <MemoryRouter initialEntries={[path]}>
        <AppNav level={3} unread={unread} />
        <button type="button">After the nav</button>
        <Where />
      </MemoryRouter>
    </I18nProvider>,
  )
}

beforeEach(() => vi.restoreAllMocks())
afterEach(() => vi.restoreAllMocks())

it('shows every link and no More button when the row is wide enough', () => {
  renderNav()
  const nav = screen.getByRole('navigation', { name: 'Main' })
  expect(within(nav).getAllByRole('link')).toHaveLength(NAV_ITEMS.length)
  expect(within(nav).getByRole('link', { name: /Progress/ })).toHaveTextContent('Lv 3')
  expect(within(nav).queryByRole('button', { name: /More/ })).not.toBeInTheDocument()
})

it('puts the links that do not fit in the More menu, which opens, moves with arrows and closes on Escape', async () => {
  // 3 links + the More button: 60 + 3 * 110 = 390.
  renderNav({ rowWidth: 400 })
  const nav = screen.getByRole('navigation', { name: 'Main' })
  expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Board', 'ENEM', 'Daily'])
  const more = within(nav).getByRole('button', { name: 'More' })
  expect(more).toHaveAttribute('aria-expanded', 'false')

  more.focus()
  await userEvent.keyboard('{ArrowDown}')
  const menu = screen.getByRole('menu', { name: 'More' })
  expect(more).toHaveAttribute('aria-expanded', 'true')
  const items = within(menu).getAllByRole('menuitem')
  expect(items.map((item) => item.getAttribute('href'))).toEqual(NAV_ITEMS.slice(3).map((item) => item.to))
  expect(items[0]).toHaveFocus()
  await userEvent.keyboard('{ArrowDown}')
  expect(items[1]).toHaveFocus()
  await userEvent.keyboard('{ArrowUp}{ArrowUp}')
  expect(items.at(-1)).toHaveFocus()

  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(more).toHaveFocus()
  expect(more).toHaveAttribute('aria-expanded', 'false')
})

it('closes the menu when a link in it is followed, and on a click outside', async () => {
  renderNav({ rowWidth: 400 })
  await userEvent.click(screen.getByRole('button', { name: 'More' }))
  await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Notes' }))
  expect(screen.getByTestId('where')).toHaveTextContent('/notes')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'More' }))
  expect(screen.getByRole('menu')).toBeInTheDocument()
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})

it('leaves the menu with Tab', async () => {
  renderNav({ rowWidth: 400 })
  await userEvent.click(screen.getByRole('button', { name: 'More' }))
  expect(screen.getByRole('menu')).toBeInTheDocument()
  await userEvent.tab()
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'After the nav' })).toHaveFocus()
})

it('marks the More button when the current page, or unread messages, are inside it', () => {
  renderNav({ path: '/messages/abc', unread: 2, rowWidth: 400 })
  const more = screen.getByRole('button', { name: /More/ })
  expect(more).toHaveClass('border-gold')
  expect(more).toHaveTextContent('(2 unread conversations)')
})

it('leaves the More button plain when the current page is in the row', () => {
  renderNav({ path: '/board', rowWidth: 400 })
  const more = screen.getByRole('button', { name: 'More' })
  expect(more).not.toHaveClass('border-gold')
  expect(more).not.toHaveTextContent('unread')
})
