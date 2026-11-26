import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import GamePanel from '../panel/game-panel.jsx'
import { StudyWindowProvider } from '../study-window/study-window-provider.jsx'
import { TODAY, makeNpcActions, makeNpcView } from './npc-fixtures.js'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

function Harness({ view, actions }) {
  const [tab, setTab] = useState('town')
  const [npc, setNpc] = useState('quests')
  return <GamePanel view={view} tab={tab} onTab={setTab} npc={npc} onNpc={setNpc} actions={actions} studyHref="/hunt" />
}

const ui = ({ view = makeNpcView(), actions, provider = false } = {}, locale = 'en') => {
  const bound = actions ?? makeNpcActions(vi, view)
  const panel = <Harness view={view} actions={bound} />
  render(<I18nProvider locale={locale}>{provider ? <StudyWindowProvider>{panel}</StudyWindowProvider> : panel}</I18nProvider>)
  return { view, actions: bound }
}

const board = () => within(screen.getByRole('list', { name: "Today's quests" }))
const quest = (name) => within(board().getByRole('listitem', { name }))

it("lists today's quests with progress and rewards", () => {
  ui()
  expect(board().getAllByRole('listitem')).toHaveLength(5)
  const hunt = quest('Defeat 150 enemies in JavaScript Forest, Canopy')
  expect(hunt.getByRole('meter')).toHaveAttribute('aria-valuenow', '0')
  expect(hunt.getByRole('meter')).toHaveAttribute('aria-valuemax', '150')
  const acertos = quest('Get 5 right answers studying')
  expect(acertos.getByRole('meter')).toHaveAttribute('aria-valuenow', '5')
  // XP already at the study multiplier (x1.4): 80 kills of the yardstick (104 xp since fase 4) become 145.
  expect(acertos.getByText('+145 XP')).toBeInTheDocument()
  expect(screen.getByText('XP already counts your study bonus (x1.4).')).toBeInTheDocument()
})

it('claims a done quest and says what it paid', async () => {
  const view = makeNpcView()
  const actions = makeNpcActions(vi, view)
  actions.claimQuest = vi.fn(async () => ({ ...view, quest: { id: 'acertos', reward: { gold: 360, xp: 112, fragments: 20 }, chests: 0, levelsGained: 0 } }))
  ui({ view, actions })
  expect(quest('Defeat 150 enemies in JavaScript Forest, Canopy').queryByRole('button', { name: 'Claim' })).toBeNull()
  fireEvent.click(quest('Get 5 right answers studying').getByRole('button', { name: 'Claim' }))
  await waitFor(() => expect(actions.claimQuest).toHaveBeenCalledWith('acertos'))
  expect(await screen.findByText('Collected: +360 gold, +112 XP, +20 fragments')).toBeInTheDocument()
})

it('marks a collected quest and counts the bonus chest', () => {
  ui({ view: makeNpcView({ questState: { day: TODAY, level: 12, kills: {}, bosses: 0, taken: ['acertos'] } }) })
  expect(quest('Get 5 right answers studying').getByText('Collected')).toBeInTheDocument()
  expect(screen.getByText('Collect all 5: +1 chest')).toBeInTheDocument()
})

it('says when the all-done chest came with the last claim', async () => {
  const view = makeNpcView()
  const actions = makeNpcActions(vi, view)
  actions.claimQuest = vi.fn(async () => ({ ...view, quest: { id: 'acertos', reward: { gold: 360, xp: 112, fragments: 20 }, chests: 1, levelsGained: 1 } }))
  ui({ view, actions })
  fireEvent.click(quest('Get 5 right answers studying').getByRole('button', { name: 'Claim' }))
  expect(await screen.findByText('Collected: +360 gold, +112 XP, +20 fragments. All done: +1 chest in the Bag')).toBeInTheDocument()
})

it('opens the study window for the acertos, daily and duel quests', () => {
  ui({ provider: true })
  fireEvent.click(quest('Win a duel').getByRole('button', { name: 'Duel' }))
  expect(screen.getByRole('region', { name: 'Study' }).querySelector('iframe')).toHaveAttribute('src', '/duel?embed=1')
})

it('links the study page when there is no study window', () => {
  ui({ view: makeNpcView({ ledgerRow: { correct: 2 } }) })
  expect(quest("Finish today's daily challenge").getByRole('link', { name: 'Open the challenge' })).toHaveAttribute('href', '/daily')
  // The page's study link (studyHref), for the acertos still to get.
  expect(quest('Get 5 right answers studying').getByRole('link', { name: 'Study' })).toHaveAttribute('href', '/hunt')
})

it('sends the hunt and boss quests to the World tab', () => {
  ui()
  fireEvent.click(quest('Win a boss fight').getByRole('button', { name: 'Go hunt' }))
  expect(screen.getByRole('tab', { name: 'World' })).toHaveAttribute('aria-selected', 'true')
})

it('speaks Portuguese', () => {
  ui({}, 'pt-BR')
  expect(screen.getByRole('list', { name: 'Missões de hoje' })).toBeInTheDocument()
  expect(screen.getByRole('listitem', { name: 'Acerte 5 questões estudando' })).toBeInTheDocument()
})
