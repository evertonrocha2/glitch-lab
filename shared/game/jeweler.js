// The Joalheiro (fase 3): sells item gems and support gems for knowledge fragments, and combines
// 3 gems of one kind and tier into 1 a tier up (gem tiers live in items.js). Pure: the server rolls ids.
import { GEMS, GEM_MAX_TIER, gemTierOf } from './items.js'
import { SUPPORT_IDS } from './skill-mods.js'

// Fragments for a tier 1 item gem of the player's pick (gems drop about 6 an hour while hunting).
export const GEM_PRICE = 25
// Fragments for a support gem of the player's pick (they drop about once an hour, and bosses' first wins).
export const SUPPORT_PRICE = 80
export const COMBINE_COUNT = 3
// Gold to combine 3 gems of a tier: x4 each tier. The top tier can't be combined.
const COMBINE_GOLD = 200
const COMBINE_GROWTH = 4

export const combineCost = (tier) => (tier >= GEM_MAX_TIER ? null : { gold: COMBINE_GOLD * COMBINE_GROWTH ** (tier - 1) })

// { gem, tier } when these are exactly COMBINE_COUNT item gems of one kind and one tier below the top,
// otherwise null.
export function combinable(items) {
  if (!Array.isArray(items) || items.length !== COMBINE_COUNT) return null
  if (!items.every((item) => item?.kind === 'gem' && Object.hasOwn(GEMS, item.gem))) return null
  const { gem } = items[0]
  const tier = gemTierOf(items[0])
  if (tier >= GEM_MAX_TIER || !items.every((item) => item.gem === gem && gemTierOf(item) === tier)) return null
  return { gem, tier }
}

export const combinedGem = (id, { gem, tier }) => ({ id, kind: 'gem', gem, tier: tier + 1 })

// What the panel shows at the jeweler: the gem and support catalog with prices, and the combine fees.
export const jewelerView = () => ({
  gems: Object.keys(GEMS).map((gem) => ({ gem, fragments: GEM_PRICE })),
  supports: SUPPORT_IDS.map((support) => ({ support, fragments: SUPPORT_PRICE })),
  combine: {
    count: COMBINE_COUNT,
    maxTier: GEM_MAX_TIER,
    gold: Object.fromEntries(Array.from({ length: GEM_MAX_TIER - 1 }, (_, at) => [at + 1, combineCost(at + 1).gold])),
  },
})
