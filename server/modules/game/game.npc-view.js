import { alchemistView } from '../../../shared/game/elixirs.js'
import { jewelerView } from '../../../shared/game/jeweler.js'
import { questsView } from '../../../shared/game/quests.js'
import { marketView } from '../../../shared/game/shop.js'

// The NPCs as the View shows them (fase 3): the merchant's stock for the default market tier (a town's
// own tier is read with GET /game/market?tier=), the alchemist's and the jeweler's catalogs with prices,
// and the quest board with progress. Read only: a new day shows fresh, and is saved on the next write.
export const npcView = (hero, { userId, today, level, ledger, multiplier, tier }) => ({
  market: marketView({ userId, market: hero.market, today, level, items: hero.items, tier }),
  alchemist: alchemistView(level),
  jeweler: jewelerView(),
  quests: questsView({ userId, state: hero.quests, today, level, ledger, multiplier }),
})
