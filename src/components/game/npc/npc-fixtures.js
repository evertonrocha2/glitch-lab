// Test fixtures for the town: the panel View plus npc { market, alchemist, jeweler, quests }, built
// with the same shared functions the server's View uses (server/modules/game/game.npc-view.js).
import { alchemistView } from '../../../../shared/game/elixirs.js'
import { jewelerView } from '../../../../shared/game/jeweler.js'
import { questsView } from '../../../../shared/game/quests.js'
import { marketView } from '../../../../shared/game/shop.js'
import { makeActions, makeView } from '../panel/fixtures.js'

export const TODAY = '2026-11-26'
export const USER = 'u1'
export const MULTIPLIER = 1.4

// ledgerRow: today's study counters ({ correct, dailies, duelWins }); questState: the hero's stored
// quests ({ day, level, kills, bosses, taken }); elixirs: { [type]: { startedAt, expiresAt } }.
export function makeNpcView({ ledgerRow = { correct: 20 }, questState = null, elixirs = {}, ...over } = {}) {
  const view = makeView(over)
  const level = view.level.level
  const ledger = { days: [{ day: TODAY, ...ledgerRow }] }
  view.hero.elixirs = elixirs
  view.study.xpMultiplier = MULTIPLIER
  view.npc = {
    market: marketView({ userId: USER, market: null, today: TODAY, level, items: view.hero.items }),
    alchemist: alchemistView(level),
    jeweler: jewelerView(),
    quests: questsView({ userId: USER, state: questState, today: TODAY, level, ledger, multiplier: MULTIPLIER }),
  }
  return view
}

// The panel's actions plus the NPC calls, each resolving to the View (as the page's bound actions do).
export function makeNpcActions(vi, view) {
  const ok = () => vi.fn(async () => view)
  return {
    ...makeActions(vi, view),
    buyMarketItem: ok(),
    sellItems: ok(),
    rerollMarket: ok(),
    buyElixir: ok(),
    buyJewel: ok(),
    combineGems: ok(),
    claimQuest: ok(),
  }
}

export const gemOf = (id, gem, tier) => (tier ? { id, kind: 'gem', gem, tier } : { id, kind: 'gem', gem })
