import { randomUUID } from 'node:crypto'
import { simulateFight } from '../../../shared/game/combat.js'
import { DIFFICULTIES } from '../../../shared/game/enemies.js'
import { pendingStudy, studyRewards } from '../../../shared/game/fuel.js'
import { GEM_SALVAGE_SCRAP, settleHunt } from '../../../shared/game/hunt.js'
import { BAG_SIZE, rollGem, rollItem, salvageValue } from '../../../shared/game/items.js'
import { createRng } from '../../../shared/game/rng.js'
import { HUNT_WORLDS, ZONES, enemyFor, zoneState } from '../../../shared/game/zones.js'
import { badRequest, codedConflict } from '../../core/errors.js'
import { isId } from '../../core/validation.js'
import { loadFuel } from './game.fuel.js'
import { MESSAGES, fighterOf, newHero, pendingTotals, toView, withDefaults } from './game.model.js'

// Glitch World v2: the server is the only authority over the hero. The client sends intents (sync,
// hunt here, stop, fight this boss); every drop, gold coin and fight result is rolled here.

export const AWAY_MIN_MS = 5 * 60_000
const INFERNO_GOLD_LOSS = 0.1

export const gameConflict = () => codedConflict(MESSAGES.conflict, 'GAME_CONFLICT')

// Every write: load the hero (or a new one), let fn change a copy, save it under the loaded version.
// Two tabs that read the same version can't both save: the second gets a 409.
export async function mutate(store, userId, fn) {
  const loaded = await store.getGameHero(userId)
  const hero = withDefaults(structuredClone(loaded?.data ?? newHero()))
  const extra = await fn(hero)
  const saved = await store.saveGameHero(userId, hero, loaded?.version ?? 0)
  if (!saved) throw gameConflict()
  return { hero: withDefaults(saved.data), extra }
}

const bagFree = (hero) => Math.max(0, BAG_SIZE - hero.items.filter((item) => !item.equipped).length)

// Known world, zone and difficulty only: the zone table is looked up with own keys, never the prototype.
function parseTarget(body) {
  const { world, zone, difficulty } = body
  if (!isId(world) || !isId(zone) || !isId(difficulty)) throw badRequest()
  if (!HUNT_WORLDS.includes(world) || !Object.hasOwn(ZONES[world], zone) || !Object.hasOwn(DIFFICULTIES, difficulty)) throw badRequest()
  return { world, zone, difficulty, def: ZONES[world][zone] }
}

function requireOpen(hero, level, { world, zone, difficulty }) {
  const state = zoneState(hero.progress, world, difficulty, level).find((item) => item.id === zone)
  if (!state?.unlocked) throw badRequest(MESSAGES.zoneLocked)
}

// The running hunt's result up to now, without changing the hero. null when no hunt runs
// (or it points at a zone that no longer exists). Each claim has its own seed, so drops never repeat.
function huntResult(hero, level, now) {
  const hunt = hero.hunt
  const zone = hunt && Object.hasOwn(ZONES[hunt.world] ?? {}, hunt.zone) ? ZONES[hunt.world][hunt.zone] : null
  if (!zone || !Object.hasOwn(DIFFICULTIES, hunt.difficulty)) return null
  return settleHunt({
    hero: fighterOf(hero, level),
    zone,
    difficulty: hunt.difficulty,
    startedAt: hunt.startedAt,
    now,
    seed: `${hunt.seed}:${hunt.claims}`,
    bagFree: bagFree(hero),
  })
}

const previewOf = (result) => (result ? { elapsedMs: result.elapsedMs, kills: result.kills, gold: result.gold } : null)

// Pays the running hunt into the hero and answers the AwaySummary when it ran long enough to show.
// keep: the hunt goes on from now (sync); otherwise it ends (stop, or a new hunt).
function settle(hero, level, now, { keep }) {
  if (!hero.hunt) return undefined
  const result = huntResult(hero, level, now)
  if (!result) {
    hero.hunt = null
    return undefined
  }
  hero.gold += result.gold
  hero.items.push(...result.items, ...result.gems)
  hero.scrap += result.scrapFromOverflow
  hero.potions.hp = Math.max(0, hero.potions.hp - result.potionsUsed.hp)
  hero.potions.mp = Math.max(0, hero.potions.mp - result.potionsUsed.mp)
  hero.hunt = keep ? { ...hero.hunt, startedAt: now, claims: hero.hunt.claims + 1 } : null
  if (result.elapsedMs < AWAY_MIN_MS) return undefined
  const away = {
    elapsedMs: result.elapsedMs,
    kills: result.kills,
    elites: result.elites,
    deaths: result.deaths,
    gold: result.gold,
    items: result.items.length,
    gems: result.gems.length,
    scrap: result.scrapFromOverflow,
  }
  hero.lastAway = away
  return away
}

// Adds every pending study reward to the hero and records it in claimed, per day.
// Answers what was claimed, or undefined when nothing was waiting.
function claimStudy(hero, ledger) {
  const pending = pendingStudy(studyRewards(ledger), hero.claimed)
  for (const [day, entry] of Object.entries(pending.byDay)) {
    const done = hero.claimed[day] ?? {}
    hero.claimed[day] = Object.fromEntries(
      ['fragments', 'potions', 'chest', 'key', 'honor'].map((field) => [field, (done[field] ?? 0) + entry[field]]),
    )
  }
  hero.fragments += pending.fragments
  hero.potions.hp += pending.potions
  hero.chests.push(...pending.chests)
  hero.keys += pending.keys
  hero.honor += pending.honor
  const claimed = pendingTotals(pending)
  const any = claimed.fragments || claimed.potions || claimed.chests.length || claimed.keys || claimed.honor
  return any ? claimed : undefined
}

async function context(store, user, today) {
  return { fuel: await loadFuel(store, user.id, today), today, now: Date.now() }
}

const viewOf = (hero, ctx) => toView(hero, { ...ctx, huntPreview: previewOf(huntResult(hero, ctx.fuel.level.level, ctx.now)) })

// Fields left undefined drop out of the JSON.
const withExtra = (view, extra) => ({ ...view, ...extra })

// Read only: a new player sees a new hero, and the running hunt is previewed, not paid.
export async function getGame(store, user, today) {
  const ctx = await context(store, user, today)
  const loaded = await store.getGameHero(user.id)
  return viewOf(withDefaults(loaded?.data ?? newHero()), ctx)
}

// Pays the running hunt (and keeps it going) and claims every pending study reward.
export async function sync(store, user, today) {
  const ctx = await context(store, user, today)
  const { hero, extra } = await mutate(store, user.id, (draft) => ({
    away: settle(draft, ctx.fuel.level.level, ctx.now, { keep: true }),
    studyClaimed: claimStudy(draft, ctx.fuel.ledger),
  }))
  return withExtra(viewOf(hero, ctx), extra)
}

// Pays any running hunt, then starts hunting { world, zone, difficulty }.
export async function startHunt(store, user, today, body) {
  const target = parseTarget(body)
  const ctx = await context(store, user, today)
  const level = ctx.fuel.level.level
  const { hero, extra } = await mutate(store, user.id, (draft) => {
    requireOpen(draft, level, target)
    const away = settle(draft, level, ctx.now, { keep: false })
    draft.hunt = {
      world: target.world,
      zone: target.zone,
      difficulty: target.difficulty,
      startedAt: ctx.now,
      seed: `${user.id}:hunt:${randomUUID()}`,
      claims: 0,
    }
    return { away }
  })
  return withExtra(viewOf(hero, ctx), extra)
}

// Pays the running hunt and ends it.
export async function stopHunt(store, user, today) {
  const ctx = await context(store, user, today)
  const { hero, extra } = await mutate(store, user.id, (draft) => ({ away: settle(draft, ctx.fuel.level.level, ctx.now, { keep: false }) }))
  return withExtra(viewOf(hero, ctx), extra)
}

// Puts a drop in the bag, or salvages it to scrap when the bag is full.
function stash(hero, drop) {
  if (bagFree(hero) > 0) {
    hero.items.push(drop)
    return true
  }
  hero.scrap += drop.kind === 'gem' ? GEM_SALVAGE_SCRAP : salvageValue(drop).scrap
  return false
}

// One boss fight, simulated here. A win marks the zone beaten and drops 1 item (rarity boost +1)
// and 1 gem; an Inferno loss costs 10% of the gold; potions drunk are gone either way.
export async function fightBoss(store, user, today, body) {
  const target = parseTarget(body)
  const ctx = await context(store, user, today)
  const level = ctx.fuel.level.level
  const { hero, extra } = await mutate(store, user.id, (draft) => {
    requireOpen(draft, level, target)
    if (level < target.def.bossLevel) throw badRequest(MESSAGES.bossLevel)
    const seed = `${user.id}:${target.zone}:${target.difficulty}:${randomUUID()}`
    const root = createRng(seed)
    const enemy = enemyFor(target.def, target.difficulty, root.fork('enemy'), { boss: true })
    const result = simulateFight({ hero: fighterOf(draft, level), enemy, seed })
    draft.potions.hp = Math.max(0, draft.potions.hp - result.potionsUsed.hp)
    draft.potions.mp = Math.max(0, draft.potions.mp - result.potionsUsed.mp)
    const loot = { items: 0, gems: 0, scrap: 0, goldLost: 0 }
    if (result.won) {
      const worldProgress = (draft.progress[target.world] ??= {})
      const beaten = (worldProgress[target.difficulty] ??= [])
      if (!beaten.includes(target.zone)) beaten.push(target.zone)
      const diff = DIFFICULTIES[target.difficulty]
      const rng = root.fork('drops')
      const scrapBefore = draft.scrap
      if (stash(draft, rollItem(rng, { ilvl: target.def.ilvl + diff.ilvl, rarityBoost: diff.rarityBoost + 1 }))) loot.items++
      if (stash(draft, rollGem(rng))) loot.gems++
      loot.scrap = draft.scrap - scrapBefore
    } else if (target.difficulty === 'inferno') {
      loot.goldLost = Math.floor(draft.gold * INFERNO_GOLD_LOSS)
      draft.gold -= loot.goldLost
    }
    const { id, sprite, element, base } = enemy
    return { fight: { ...result, enemy: { id, sprite, element, base }, loot } }
  })
  return withExtra(viewOf(hero, ctx), extra)
}
