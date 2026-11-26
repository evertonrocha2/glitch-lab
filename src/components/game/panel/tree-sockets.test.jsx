// Fase 2c: the tree's skill passives and socket nodes in the Árvore tab, and the socket picker.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { makeActions, makeView } from './fixtures.js'
import GamePanel from './game-panel.jsx'
import TreeTab from './tree-tab.jsx'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

function Harness({ view, actions }) {
  const [tab, setTab] = useState('tree')
  return <GamePanel view={view} tab={tab} onTab={setTab} actions={actions} treeTab={(shared) => <TreeTab {...shared} />} />
}

const ui = ({ view = makeView(), actions } = {}, locale = 'en') => {
  const bound = actions ?? makeActions(vi, view)
  render(
    <I18nProvider locale={locale}>
      <Harness view={view} actions={bound} />
    </I18nProvider>,
  )
  return { view, actions: bound }
}

const nodeList = () => screen.getByRole('list', { name: /talent nodes|nós da árvore/i })
const nodeButton = (name) => within(nodeList()).getByRole('button', { name })
const support = (id, name) => ({ id, kind: 'support', support: name })
const SOCKET_PATH = ['root', 'logica-c0', 'logica-c1', 'logica-f0-1']
const FIRE = support('bbbbbbbbbbb1', 'fogo')
const CHAIN = support('bbbbbbbbbbb2', 'encadear')
const CHAIN_TWIN = support('bbbbbbbbbbb3', 'encadear')
const COLD = support('bbbbbbbbbbb4', 'frio')

it('names a skill passive and says what it changes', () => {
  ui()
  fireEvent.click(nodeButton('Double Strike (Logic skill passive), locked'))
  expect(screen.getByRole('heading', { name: 'Double Strike' })).toBeInTheDocument()
  expect(screen.getByText('Logic skill passive')).toBeInTheDocument()
  expect(screen.getByText('Strike hits again right after, at 50% power')).toBeInTheDocument()
})

it('names every passive and socket in Portuguese', () => {
  ui({}, 'pt-BR')
  fireEvent.click(nodeButton('Exceção Fatal (Passiva de skill de Lógica), bloqueado'))
  expect(screen.getByText('Crítico de skill explode: 30% do dano nos inimigos a até 1,5 blocos do alvo')).toBeInTheDocument()
  fireEvent.click(nodeButton('Engaste (Engaste de Lógica, trilha lateral, 3 passos depois de Raiz), bloqueado'))
  expect(screen.getByText('Guarda uma gema de suporte. O suporte muda toda skill em que ele se encaixa.')).toBeInTheDocument()
  expect(screen.getByText('Pegue esse nó pra usar o engaste.')).toBeInTheDocument()
})

it('lists the four sockets with labels that tell them apart, and the legend names both new kinds', () => {
  ui()
  const sockets = within(nodeList()).getAllByRole('button', { name: /^Socket \(/ })
  expect(sockets).toHaveLength(4)
  expect(new Set(sockets.map((button) => button.textContent)).size).toBe(4)
  expect(screen.getByText('Skill passive: changes how a skill works')).toBeInTheDocument()
  expect(screen.getByText('Socket: holds a support gem')).toBeInTheDocument()
})

it('opens the picker on a taken empty socket and sockets a support gem from the bag', async () => {
  const view = makeView({ talents: SOCKET_PATH, items: [FIRE, CHAIN] })
  const { actions } = ui({ view })
  fireEvent.click(nodeButton(/^Socket \(Logic socket, side path, 3 steps past Root\), taken/))
  expect(screen.getByText('Empty')).toBeInTheDocument()
  const picker = screen.getByRole('list', { name: 'Your support gems' })
  expect(within(picker).getByText('Skill hits add 20% of their damage as fire')).toBeInTheDocument()
  expect(within(picker).getByText('Chain skills jump to 2 more foes')).toBeInTheDocument()
  fireEvent.click(within(picker).getByRole('button', { name: 'Socket Added Fire' }))
  await waitFor(() => expect(actions.socketSupport).toHaveBeenCalledWith('logica-f0-1', FIRE.id))
  expect(await screen.findByText('Added Fire socketed.')).toBeInTheDocument()
})

it('shows what a filled socket holds, swaps and removes, and turns off a kind already socketed', async () => {
  const view = makeView({
    talents: [...SOCKET_PATH, 'algoritmos-c0', 'algoritmos-c1', 'algoritmos-f0-1'],
    items: [CHAIN_TWIN, COLD],
  })
  view.hero.treeSockets = { 'logica-f0-1': FIRE, 'algoritmos-f0-1': CHAIN }
  const { actions } = ui({ view })
  fireEvent.click(nodeButton(/^Socket \(Logic socket, side path, 3 steps past Root\), taken/))
  expect(screen.getByText('Holds: Added Fire')).toBeInTheDocument()
  const picker = screen.getByRole('list', { name: 'Your support gems' })
  const twin = within(picker).getByRole('button', { name: 'Swap in Chain' })
  expect(twin).toBeDisabled()
  expect(twin).toHaveAccessibleDescription('Already in another socket')
  fireEvent.click(within(picker).getByRole('button', { name: 'Swap in Biting Cold' }))
  await waitFor(() => expect(actions.socketSupport).toHaveBeenCalledWith('logica-f0-1', COLD.id))
  fireEvent.click(screen.getByRole('button', { name: 'Remove Added Fire' }))
  await waitFor(() => expect(actions.unsocketSupport).toHaveBeenCalledWith('logica-f0-1'))
  expect(await screen.findByText('Added Fire is back in the bag.')).toBeInTheDocument()
})

it('says where support gems come from when the bag has none', () => {
  ui({ view: makeView({ talents: SOCKET_PATH }) })
  fireEvent.click(nodeButton(/^Socket \(Logic socket, side path, 3 steps past Root\), taken/))
  expect(screen.getByText("You have no support gems yet. They drop from hunts (rarely) and from every boss's first win.")).toBeInTheDocument()
})

it('gives every skill passive and support gem a name no other talent or skill has, in both languages', async () => {
  const { MESSAGES } = await import('../../../lib/i18n/catalog.js')
  for (const locale of ['en', 'pt-BR']) {
    const all = MESSAGES[locale]
    const taken = Object.entries(all).filter(([key]) => /^game\.(talent|skill)\./.test(key)).map(([, value]) => value)
    const mine = Object.entries(all).filter(([key]) => /^game\.(passive|support)\./.test(key)).map(([, value]) => value)
    expect(mine).toHaveLength(20)
    for (const name of mine) expect(taken, `${locale}: ${name}`).not.toContain(name)
    expect(new Set(mine).size).toBe(mine.length)
  }
})
