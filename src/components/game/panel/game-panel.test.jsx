import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { makeActions, makeView } from './fixtures.js'
import GamePanel from './game-panel.jsx'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

function Harness({ start = 'hero', ...props }) {
  const [tab, setTab] = useState(start)
  return <GamePanel view={props.view ?? makeView()} tab={tab} onTab={setTab} actions={props.actions ?? makeActions(vi)} {...props} />
}

const ui = (props = {}, locale = 'en') =>
  render(
    <I18nProvider locale={locale}>
      <Harness {...props} />
    </I18nProvider>,
  )

it('renders five tabs with the selected one in the tab order', () => {
  ui()
  const tabs = screen.getAllByRole('tab')
  expect(tabs.map((tab) => tab.textContent)).toEqual(['Hero', expect.stringContaining('Tree'), 'Bag', 'Forge', 'World'])
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  expect(tabs[0]).toHaveAttribute('tabindex', '0')
  expect(tabs[1]).toHaveAttribute('tabindex', '-1')
  const panel = screen.getByRole('tabpanel')
  expect(tabs[0]).toHaveAttribute('aria-controls', panel.id)
  expect(panel).toHaveAttribute('aria-labelledby', tabs[0].id)
})

it('keeps the five tabs in one tablist, each with its icon and label', () => {
  ui()
  const lists = screen.getAllByRole('tablist')
  expect(lists).toHaveLength(1)
  const tabs = screen.getAllByRole('tab')
  expect(tabs).toHaveLength(5)
  for (const tab of tabs) {
    expect(lists[0]).toContainElement(tab)
    expect(tab.querySelector('canvas')).not.toBeNull()
    expect(tab).toHaveAttribute('data-tone', tab.getAttribute('aria-selected') === 'true' ? 'raised' : 'inset')
  }
})

it('moves between tabs with the arrow keys, wrapping, and Home / End', () => {
  ui()
  const hero = screen.getByRole('tab', { name: 'Hero' })
  hero.focus()
  fireEvent.keyDown(hero, { key: 'ArrowRight' })
  const tree = screen.getByRole('tab', { name: /Tree/ })
  expect(tree).toHaveAttribute('aria-selected', 'true')
  expect(tree).toHaveFocus()
  fireEvent.keyDown(tree, { key: 'ArrowLeft' })
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Hero' }), { key: 'ArrowLeft' })
  expect(screen.getByRole('tab', { name: 'World' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: 'World' })).toHaveFocus()
  fireEvent.keyDown(screen.getByRole('tab', { name: 'World' }), { key: 'Home' })
  expect(screen.getByRole('tab', { name: 'Hero' })).toHaveFocus()
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Hero' }), { key: 'End' })
  expect(screen.getByRole('tab', { name: 'World' })).toHaveAttribute('aria-selected', 'true')
})

it('switches tab on click', () => {
  const onTab = vi.fn()
  render(<GamePanel view={makeView()} tab="hero" onTab={onTab} actions={makeActions(vi)} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Bag' }))
  expect(onTab).toHaveBeenCalledWith('bag')
})

it('badges the tree tab with free talent points', () => {
  ui({ view: makeView({ free: 6 }) })
  expect(screen.getByRole('tab', { name: 'Tree, 6 free points' })).toBeInTheDocument()
})

it('hides the badge with no free points', () => {
  ui({ view: makeView({ free: 0 }) })
  expect(screen.getByRole('tab', { name: 'Tree' })).toBeInTheDocument()
})

it('plugs the tree and world slots in', () => {
  ui({ start: 'tree', treeTab: <p>talent tree here</p>, worldTab: <p>world here</p> })
  expect(screen.getByText('talent tree here')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: 'World' }))
  expect(screen.getByText('world here')).toBeInTheDocument()
  expect(screen.queryByText('talent tree here')).toBeNull()
})

it('shows the wallet in the reader language', () => {
  ui({ view: makeView({ gold: 12500 }) }, 'pt-BR')
  expect(screen.getByText('12.500')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Herói' })).toBeInTheDocument()
})
