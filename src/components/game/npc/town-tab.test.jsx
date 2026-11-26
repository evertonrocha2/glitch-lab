import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import GamePanel from '../panel/game-panel.jsx'
import { makeNpcActions, makeNpcView } from './npc-fixtures.js'
import { npcTarget } from './npcs.js'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

// controlled: the page holds the open keeper (npc / onNpc), as game-view does; otherwise the panel does.
function Harness({ start = 'town', startNpc = null, controlled = false, view, actions }) {
  const [tab, setTab] = useState(start)
  const [npc, setNpc] = useState(startNpc)
  const own = controlled ? { npc, onNpc: setNpc } : {}
  return <GamePanel view={view} tab={tab} onTab={setTab} actions={actions} {...own} />
}

const ui = (props = {}, locale = 'en') => {
  const view = props.view ?? makeNpcView()
  const actions = props.actions ?? makeNpcActions(vi, view)
  render(
    <I18nProvider locale={locale}>
      <Harness {...props} view={view} actions={actions} />
    </I18nProvider>,
  )
  return { view, actions }
}

const keepers = () => within(screen.getByRole('list', { name: 'Town keepers' }))

it('adds a Town tab between the Forge and the World', () => {
  ui({ start: 'hero' })
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Hero', expect.stringContaining('Tree'), 'Bag', 'Forge', 'Town', 'World'])
})

it('lists the five keepers with a portrait each', () => {
  ui()
  const cards = keepers().getAllByRole('button')
  expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
    expect.stringMatching(/^Merchant/),
    expect.stringMatching(/^Alchemist/),
    expect.stringMatching(/^Blacksmith/),
    expect.stringMatching(/^Jeweler/),
    expect.stringMatching(/^Quest board/),
  ])
  for (const card of cards) expect(card.querySelector('[data-npc]')).not.toBeNull()
})

it('says what each keeper has today on its card', () => {
  ui()
  expect(keepers().getByRole('button', { name: /^Merchant/ })).toHaveTextContent('6 pieces today')
  expect(keepers().getByRole('button', { name: /^Quest board/ })).toHaveTextContent('1 to collect')
})

it('opens a keeper and goes back to the town', () => {
  ui()
  fireEvent.click(keepers().getByRole('button', { name: /^Jeweler/ }))
  expect(screen.getByRole('heading', { name: 'Jeweler' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Back to town' }))
  expect(screen.getByRole('list', { name: 'Town keepers' })).toBeInTheDocument()
})

it('sends the Blacksmith to the Forge tab', () => {
  ui()
  fireEvent.click(keepers().getByRole('button', { name: /^Blacksmith/ }))
  expect(screen.getByRole('tab', { name: 'Forge' })).toHaveAttribute('aria-selected', 'true')
})

it('opens the keeper the page asks for (openNpc), controlled by npc / onNpc', () => {
  ui({ controlled: true, startNpc: 'quests' })
  expect(screen.getByRole('heading', { name: 'Quest board' })).toBeInTheDocument()
})

it('maps every keeper id to where it opens', () => {
  expect(npcTarget('merchant')).toEqual({ tab: 'town', npc: 'merchant' })
  expect(npcTarget('alchemist')).toEqual({ tab: 'town', npc: 'alchemist' })
  expect(npcTarget('jeweler')).toEqual({ tab: 'town', npc: 'jeweler' })
  expect(npcTarget('quests')).toEqual({ tab: 'town', npc: 'quests' })
  expect(npcTarget('smith')).toEqual({ tab: 'forge', npc: null })
  expect(npcTarget('nobody')).toEqual({ tab: 'town', npc: null })
})

it('waits for the town when the View has no npc yet', () => {
  const view = makeNpcView()
  view.npc = undefined
  ui({ view, startNpc: 'merchant', controlled: true })
  expect(screen.getByText('The town opens on the next sync.')).toBeInTheDocument()
})

it('speaks Portuguese', () => {
  ui({}, 'pt-BR')
  expect(screen.getByRole('tab', { name: 'Cidade' })).toBeInTheDocument()
  const list = within(screen.getByRole('list', { name: 'Moradores da cidade' }))
  expect(list.getByRole('button', { name: /^Mercador/ })).toHaveTextContent('6 peças hoje')
  expect(list.getByRole('button', { name: /^Ferreiro/ })).toBeInTheDocument()
})
