import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, expect, it, vi } from 'vitest'
import { TALENTS } from '../../../../shared/game/talents.js'
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
// logica-c0, the first Logic node: other small Logic nodes give +2 attack too, so its label says where it is.
const A0_OPEN = '+2 attack (Logic small node, 1 step past Root), can take'
const A0_QUEUED = '+2 attack (Logic small node, 1 step past Root), in queue'

it('lists every node of the tree as a button, for the keyboard and screen readers', () => {
  ui()
  const buttons = within(nodeList()).getAllByRole('button')
  expect(buttons).toHaveLength(TALENTS.nodes.length)
  // Every label is unique, even for small nodes with the same bonus.
  expect(new Set(buttons.map((button) => button.textContent)).size).toBe(TALENTS.nodes.length)
  expect(nodeButton('Root (Start of the tree), taken')).toBeInTheDocument()
  expect(nodeButton('+8 health (Syntax small node, 1 step past Root), can take')).toBeInTheDocument()
  expect(nodeButton('+3 armor (Syntax small node, side path, 1 step past Semicolon), locked')).toBeInTheDocument()
})

it('blocks Recursion until the Algorithms answers are there, with live progress', () => {
  ui({ view: makeView({ branch: { logica: 0, sintaxe: 0, algoritmos: 39 } }) })
  fireEvent.click(nodeButton('Recursion (Algorithms keystone), locked'))
  expect(screen.getByText('Needs 40 correct answers in Algorithms questions (39 of 40)')).toBeInTheDocument()
  const take = screen.getByRole('button', { name: 'Take' })
  expect(take).toHaveAccessibleDescription('Needs 1 more correct answer in Algorithms')
  fireEvent.click(take)
  expect(screen.queryByRole('button', { name: /^Confirm/ })).toBeNull()
})

it('shows the Portuguese progress line', () => {
  ui({ view: makeView({ branch: { logica: 0, sintaxe: 0, algoritmos: 12 } }) }, 'pt-BR')
  fireEvent.click(nodeButton('Recursão (Pedra angular de Algoritmos), bloqueado'))
  expect(screen.getByText('Precisa: 40 acertos em questões de Algoritmos (12 de 40)')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pegar' })).toHaveAccessibleDescription('Faltam 28 acertos em Algoritmos')
})

it('expands the tree in a dialog where nodes can be picked and confirmed, and Escape closes it', async () => {
  const { actions } = ui()
  fireEvent.click(nodeButton(A0_OPEN))
  fireEvent.click(screen.getByRole('button', { name: 'Take' }))
  const expand = screen.getByRole('button', { name: 'Expand tree' })
  expand.focus()
  fireEvent.click(expand)
  const dialog = screen.getByRole('dialog', { name: 'Talent tree' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog.querySelector('canvas[data-tree]')).not.toBeNull()
  // The tab's canvas steps aside while the dialog draws the tree.
  expect(document.querySelectorAll('canvas[data-tree]')).toHaveLength(1)
  expect(within(dialog).getByRole('region', { name: '1 node in the queue' })).toBeInTheDocument()
  fireEvent.click(within(within(dialog).getByRole('list', { name: 'Talent nodes' })).getByRole('button', { name: /^\+8 health .*can take$/ }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Take' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm (2)' }))
  await waitFor(() => expect(actions.allocateTalents).toHaveBeenCalledWith(['logica-c0', 'sintaxe-c0']))
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(expand).toHaveFocus()
})

it('queues a reachable node and confirms it with allocateTalents', async () => {
  const { actions } = ui()
  fireEvent.click(nodeButton(A0_OPEN))
  expect(screen.getByRole('heading', { name: '+2 attack' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Take' }))
  expect(nodeButton(A0_QUEUED)).toBeInTheDocument()
  expect(screen.getByText('Free points')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm (1)' }))
  await waitFor(() => expect(actions.allocateTalents).toHaveBeenCalledWith(['logica-c0']))
  expect(await screen.findByText('Took 1 node')).toBeInTheDocument()
})

it('refuses an unreachable node with the reason and does not queue it', () => {
  ui({}, 'pt-BR')
  fireEvent.click(nodeButton('Força Bruta (Pedra angular de Lógica), bloqueado'))
  const take = screen.getByRole('button', { name: 'Pegar' })
  expect(take).toBeDisabled()
  expect(take).toHaveAccessibleDescription('Ligue a um nó que você já tem')
  fireEvent.click(take)
  expect(screen.queryByRole('button', { name: /^Confirmar/ })).toBeNull()
})

it('says there are no free points', () => {
  ui({ view: makeView({ free: 0 }) })
  fireEvent.click(nodeButton('+2 attack (Logic small node, 1 step past Root), locked'))
  expect(screen.getByRole('button', { name: 'Take' })).toHaveAccessibleDescription('No free points')
})

it('chains queued nodes and drops the ones that hang on a removed node', () => {
  ui()
  fireEvent.click(nodeButton(A0_OPEN))
  fireEvent.click(screen.getByRole('button', { name: 'Take' }))
  fireEvent.click(nodeButton('+1.5% attack (Logic small node, 2 steps past Root), can take'))
  fireEvent.click(screen.getByRole('button', { name: 'Take' }))
  expect(screen.getByRole('button', { name: 'Confirm (2)' })).toBeInTheDocument()
  fireEvent.click(nodeButton(A0_QUEUED))
  fireEvent.click(screen.getByRole('button', { name: 'Remove from queue' }))
  expect(screen.queryByRole('button', { name: /^Confirm/ })).toBeNull()
})

it('selects a node by clicking the canvas', () => {
  ui()
  const canvas = document.querySelector('canvas[data-tree]')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 380, height: 220, right: 380, bottom: 220, x: 0, y: 0 })
  const node = TALENTS.nodes.find((each) => each.id === 'recursao')
  fireEvent.click(canvas, { clientX: node.x / 2, clientY: node.y / 2 })
  expect(screen.getByRole('heading', { name: 'Recursion' })).toBeInTheDocument()
  expect(screen.getByText('Skills have a 25% chance to cast again')).toBeInTheDocument()
  expect(screen.getByText('Every skill costs double mana')).toBeInTheDocument()
  expect(screen.getByText('Needs 40 correct answers in Algorithms questions (0 of 40)')).toBeInTheDocument()
})

it('shows the keystone tooltip in Portuguese with its stats', () => {
  ui({}, 'pt-BR')
  fireEvent.click(nodeButton('Tipagem Forte (Pedra angular de Sintaxe), bloqueado'))
  expect(screen.getByText('+40% de vida')).toBeInTheDocument()
  expect(screen.getByText('-15% de velocidade de ataque')).toHaveAttribute('data-trend', 'down')
  expect(screen.getByText('Você não pode ser atordoado')).toBeInTheDocument()
})

it('turns a server refusal into its reason', async () => {
  const view = makeView()
  const actions = makeActions(vi, view)
  actions.allocateTalents = vi.fn(async () => {
    throw Object.assign(new Error("You can't take that talent."), { status: 400, reason: 'requirement' })
  })
  ui({ view, actions })
  fireEvent.click(nodeButton(A0_OPEN))
  fireEvent.click(screen.getByRole('button', { name: 'Take' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm (1)' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Not enough correct answers in that branch yet')
})

it('respecs every point for gold after a confirm', async () => {
  const { actions } = ui({ view: makeView({ talents: ['root', 'logica-c0', 'logica-c1'], gold: 500 }) }, 'pt-BR')
  fireEvent.click(screen.getByRole('button', { name: 'Refazer tudo (100 ouro)' }))
  expect(actions.respecTalents).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Sim, refazer (100 ouro)' }))
  await waitFor(() => expect(actions.respecTalents).toHaveBeenCalled())
})

it('turns respec off when there is nothing to take back or gold is short', () => {
  ui({ view: makeView({ talents: ['root', 'logica-c0', 'logica-c1'], gold: 10 }) })
  expect(screen.getByRole('button', { name: 'Respec all (100 gold)' })).toHaveAccessibleDescription('Not enough gold')
})

it('switches to the skills view', () => {
  ui()
  const skills = screen.getByRole('button', { name: 'Skills' })
  expect(skills).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(skills)
  expect(skills).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('heading', { name: 'Equipped skills' })).toBeInTheDocument()
})
