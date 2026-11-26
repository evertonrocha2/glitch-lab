import { randomUUID } from 'node:crypto'
import { simulateFight } from '../../../shared/game/combat.js'
import { buffFighter, elixirEffects } from '../../../shared/game/elixirs.js'
import { DIFFICULTIES } from '../../../shared/game/enemies.js'
import { BOSS_FIRST_FRAGMENTS, BOSS_FRAGMENTS } from '../../../shared/game/fragments.js'
import { pendingStudy, studyRewards } from '../../../shared/game/fuel.js'
import { GEM_SALVAGE_SCRAP, MAX_HUNT_MS, settleHunt } from '../../../shared/game/hunt.js'
import { BAG_SIZE, rollGem, rollItem, rollSupport, salvageValue } from '../../../shared/game/items.js'
import { countBoss, countKills, questState } from '../../../shared/game/quests.js'
import { createRng } from '../../../shared/game/rng.js'
import { bossXp, correctToday, levelsGained, startingXp, studyMultiplier } from '../../../shared/game/xp.js'
import { HUNT_WORLDS, ZONES, enemyFor } from '../../../shared/game/zones.js'
import { badRequest, codedConflict } from '../../core/errors.js'
import { isId } from '../../core/validation.js'
import { loadFuel } from './game.fuel.js'
import { MESSAGES, fighterOf, levelOf, newHero, pendingTotals, talentPointsOf, toView, withDefaults } from './game.model.js'

// Glitch World v2: the server is the only authority over the hero. The client sends intents (sync,
// hunt here, stop, fight this boss); every drop, gold coin, XP point and fight result is rolled here.
// Hunting and first boss wins give XP; today's acertos multiply it (shared/game/xp.js).

export const AWAY_MIN_MS = 5 * 60_000
const INFERNO_GOLD_LOSS = 0.1

export const gameConflict = () => codedConflict(MESSAGES.conflict, 'GAME_CONFLICT')

// What fn answers when it changed nothing: mutate then skips the save.
export const NO_CHANGE = Symbol('no change')

// Every write: load the hero (or a new one), let fn change a copy, save it under the loaded version.
// Two tabs that read the same version can't both save: the second gets a 409.
export async function mutate(store, userId, fn) {
  const loaded = await store.getGameHero(userId)
  const hero = withDefaults(structuredClone(loaded?.data ?? newHero()))
  const extra = await fn(hero)
  if (extra === NO_CHANGE) return { hero, extra: {} }
  const saved = await store.saveGameHero(userId, hero, loaded?.version ?? 0)
  if (!saved) throw gameConflict()
  return { hero: withDefaults(saved.data), extra }
}

// A hero saved before XP was stored gets the XP its study gave (so it keeps its level); it is saved
// with the next write. Stored XP is never touched here.
const seedXp = (hero, fuel) => {
  hero.xp = startingXp(hero, fuel.studyXp)
}

// mutate, with the hero's XP seeded before fn sees it.
const change = (store, user, ctx, fn) =>
  mutate(store, user.id, (draft) => {
    seedXp(draft, ctx.fuel)
    return fn(draft)
  })

export const bagFree = (hero) => Math.max(0, BAG_SIZE - hero.items.filter((item) => !item.equipped).length)

// Known world, zone and difficulty only: the zone table is looked up with own keys, never the prototype.
// Every zone and difficulty of a hunt world is open at any level (shared/game/zones.js): danger is the
// only limit, so nothing else is checked here.
function parseTarget(body) {
  const { world, zone, difficulty } = body
  if (!isId(world) || !isId(zone) || !isId(difficulty)) throw badRequest()
  if (!HUNT_WORLDS.includes(world) || !Object.hasOwn(ZONES[world], zone) || !Object.hasOwn(DIFFICULTIES, difficulty)) throw badRequest()
  return { world, zone, difficulty, def: ZONES[world][zone] }
}

// The running hunt's result up to now, without changing the hero. null when no hunt runs
// (or it points at a zone that no longer exists). Each claim has its own seed, so drops never repeat.
// The stretch fights at the level the hero has when it is paid, and earns XP at the multiplier
// recorded when it began (a hunt saved before multipliers existed: x1). Elixirs (fase 3) count for the
// share of the stretch they covered: xp on top of the study multiplier, drop luck, and damage in the fights.
function huntResult(hero, now) {
  const hunt = hero.hunt
  const zone = hunt && Object.hasOwn(ZONES[hunt.world] ?? {}, hunt.zone) ? ZONES[hunt.world][hunt.zone] : null
  if (!zone || !Object.hasOwn(DIFFICULTIES, hunt.difficulty)) return null
  const boost = elixirEffects(hero.elixirs, hunt.startedAt, Math.min(now, hunt.startedAt + MAX_HUNT_MS))
  return settleHunt({
    hero: buffFighter(fighterOf(hero, levelOf(hero).level), boost.damage),
    zone,
    difficulty: hunt.difficulty,
    startedAt: hunt.startedAt,
    now,
    seed: `${hunt.seed}:${hunt.claims}`,
    bagFree: bagFree(hero),
    xpMultiplier: (hunt.xpMultiplier ?? 1) * (1 + boost.xp),
    dropLuck: boost.luck,
  })
}

// sync pays a hunt only after AWAY_MIN_MS: settling every minute would throw away each partial fight
// cycle and every elite under 10 kills. A start in the future is settled at once (it pays 0 and
// restarts the hunt from now).
const dueForSync = (hunt, now) => Boolean(hunt) && (now - hunt.startedAt >= AWAY_MIN_MS || now < hunt.startedAt)

// The running hunt so far, plus its first sample fights (log and foe) for the client to animate.
const previewOf = (result) =>
  result ? { elapsedMs: result.elapsedMs, kills: result.kills, gold: result.gold, xp: result.xp, fragments: result.fragments, samples: result.samples } : null

// Pays the running hunt into the hero and answers the AwaySummary when it ran long enough to show.
// keep: the hunt goes on from now (sync), its next stretch at multiplier (today's, as it is now);
// otherwise it ends (stop, or a new hunt). Each stretch keeps the multiplier it began with, so study
// done mid-stretch boosts the next one (sync pays a stretch once it ran AWAY_MIN_MS).
// today: the client's day, whose quests (fase 3) count the stretch's kills in its zone.
export function settle(hero, now, { keep, multiplier = 1, today }) {
  if (!hero.hunt) return undefined
  const result = huntResult(hero, now)
  if (!result) {
    hero.hunt = null
    return undefined
  }
  if (today) hero.quests = countKills(questState(hero.quests, today, levelOf(hero).level), hero.hunt, result.kills)
  const xpBefore = hero.xp
  const paidAt = hero.hunt.xpMultiplier ?? 1
  hero.xp += result.xp
  hero.gold += result.gold
  hero.fragments += result.fragments
  hero.items.push(...result.items, ...result.gems, ...result.supports)
  hero.scrap += result.scrapFromOverflow
  hero.potions.hp = Math.max(0, hero.potions.hp - result.potionsUsed.hp)
  hero.potions.mp = Math.max(0, hero.potions.mp - result.potionsUsed.mp)
  hero.hunt = keep ? { ...hero.hunt, startedAt: now, claims: hero.hunt.claims + 1, xpMultiplier: multiplier } : null
  if (result.elapsedMs < AWAY_MIN_MS) return undefined
  const away = {
    elapsedMs: result.elapsedMs,
    kills: result.kills,
    elites: result.elites,
    deaths: result.deaths,
    gold: result.gold,
    fragments: result.fragments,
    items: result.items.length,
    gems: result.gems.length,
    supports: result.supports.length,
    scrap: result.scrapFromOverflow,
    xp: result.xp,
    xpMultiplier: paidAt,
    levelsGained: levelsGained(xpBefore, hero.xp),
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

// multiplier: what today's acertos multiply hunt XP by, for stretches and boss wins that begin now.
async function context(store, user, today) {
  const fuel = await loadFuel(store, user.id, today)
  return { fuel, today, now: Date.now(), multiplier: studyMultiplier(correctToday(fuel.ledger, today)), userId: user.id }
}

const viewOf = (hero, ctx) => toView(hero, { ...ctx, huntPreview: previewOf(huntResult(hero, ctx.now)) })

// Fields left undefined drop out of the JSON.
const withExtra = (view, extra) => ({ ...view, ...extra })

// Every build and economy action (game.build.js, game.forge.js): in one save, pay the running hunt
// with the build as it was (whatever its length), let fn change the hero, and keep the hunt going from
// now with the new build. Actions that leave the build alone (potions, look, chests, salvage) settle
// too, so the hunt is always paid with the bag and stock it ran with. When fn throws, nothing is saved,
// not even the settlement. fn gets the hero and { fuel, today, now, multiplier, level, talentPoints }
// (level and talent points after the settlement paid its XP) and answers extra fields.
export async function act(store, user, today, fn) {
  const ctx = await context(store, user, today)
  const { hero, extra } = await change(store, user, ctx, (draft) => {
    const away = settle(draft, ctx.now, { keep: true, multiplier: ctx.multiplier, today: ctx.today })
    const level = levelOf(draft).level
    return { away, ...fn(draft, { ...ctx, level, talentPoints: talentPointsOf(draft, ctx.fuel.ledger) }) }
  })
  return withExtra(viewOf(hero, ctx), extra)
}

// The hero's item with this id (a gem or gear), or a 400.
export function itemOf(hero, id) {
  if (!isId(id)) throw badRequest()
  const item = hero.items.find((each) => each.id === id)
  if (!item) throw badRequest(MESSAGES.badItem)
  return item
}

export function gearOf(hero, id) {
  const item = itemOf(hero, id)
  if (item.kind !== 'gear') throw badRequest(MESSAGES.badItem)
  return item
}

// Whole numbers from min to max, both included.
export const isIntIn = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max

// Takes a price in one currency, or a 400 with its message when the hero can't pay.
export function spend(hero, field, amount, message) {
  if (hero[field] < amount) throw badRequest(message)
  hero[field] -= amount
}

// Read only: a new player sees a new hero, and the running hunt is previewed, not paid.
export async function getGame(store, user, today) {
  const ctx = await context(store, user, today)
  const loaded = await store.getGameHero(user.id)
  const hero = withDefaults(loaded?.data ?? newHero())
  seedXp(hero, ctx.fuel)
  return viewOf(hero, ctx)
}

// Pays the running hunt once it ran AWAY_MIN_MS (and keeps it going) and claims every pending
// study reward. When neither happens nothing is saved, so an idle player's polling never writes.
export async function sync(store, user, today) {
  const ctx = await context(store, user, today)
  const { hero, extra } = await change(store, user, ctx, (draft) => {
    const due = dueForSync(draft.hunt, ctx.now)
    const away = due ? settle(draft, ctx.now, { keep: true, multiplier: ctx.multiplier, today: ctx.today }) : undefined
    const studyClaimed = claimStudy(draft, ctx.fuel.ledger)
    return due || studyClaimed ? { away, studyClaimed } : NO_CHANGE
  })
  return withExtra(viewOf(hero, ctx), extra)
}

// Pays any running hunt, then starts hunting { world, zone, difficulty }, at today's multiplier.
export async function startHunt(store, user, today, body) {
  const target = parseTarget(body)
  const ctx = await context(store, user, today)
  const { hero, extra } = await change(store, user, ctx, (draft) => {
    const away = settle(draft, ctx.now, { keep: false, today: ctx.today })
    draft.hunt = {
      world: target.world,
      zone: target.zone,
      difficulty: target.difficulty,
      startedAt: ctx.now,
      seed: `${user.id}:hunt:${randomUUID()}`,
      claims: 0,
      xpMultiplier: ctx.multiplier,
    }
    return { away }
  })
  return withExtra(viewOf(hero, ctx), extra)
}

// Pays the running hunt and ends it.
export async function stopHunt(store, user, today) {
  const ctx = await context(store, user, today)
  const { hero, extra } = await change(store, user, ctx, (draft) => ({ away: settle(draft, ctx.now, { keep: false, today: ctx.today }) }))
  return withExtra(viewOf(hero, ctx), extra)
}

// Puts a drop in the bag, or salvages it to scrap when the bag is full.
export function stash(hero, drop) {
  if (bagFree(hero) > 0) {
    hero.items.push(drop)
    return true
  }
  hero.scrap += drop.kind === 'gem' ? GEM_SALVAGE_SCRAP : salvageValue(drop).scrap
  return false
}

// One boss fight, simulated here (an instant replay: the client plays its log, format in combat.js). The first win per world, difficulty and zone marks the zone beaten,
// drops 1 item (rarity boost +1), 1 gem and 1 support gem, pays bossXp at today's multiplier and
// BOSS_FIRST_FRAGMENTS knowledge fragments (fase 4). A later win pays BOSS_FRAGMENTS once a day per
// boss and difficulty, and nothing more, so a script can't farm the boss. An Inferno loss costs 10% of
// the gold; potions drunk are gone either way.
export async function fightBoss(store, user, today, body) {
  const target = parseTarget(body)
  const ctx = await context(store, user, today)
  const { hero, extra } = await change(store, user, ctx, (draft) => {
    const level = levelOf(draft).level
    const seed = `${user.id}:${target.zone}:${target.difficulty}:${randomUUID()}`
    const root = createRng(seed)
    const enemy = enemyFor(target.def, target.difficulty, root.fork('enemy'), { boss: true })
    // The boss alone at first; its phases call its adds (rolled with it by enemyFor). An active damage
    // or xp elixir counts in full (the fight is an instant).
    const boost = elixirEffects(draft.elixirs, ctx.now, ctx.now)
    const result = simulateFight({ hero: buffFighter(fighterOf(draft, level), boost.damage), enemies: [enemy], seed })
    draft.potions.hp = Math.max(0, draft.potions.hp - result.potionsUsed.hp)
    draft.potions.mp = Math.max(0, draft.potions.mp - result.potionsUsed.mp)
    const loot = { items: 0, gems: 0, supports: 0, scrap: 0, goldLost: 0, xp: 0, levelsGained: 0, fragments: 0 }
    if (result.won) {
      draft.quests = countBoss(questState(draft.quests, ctx.today, level))
      const worldProgress = (draft.progress[target.world] ??= {})
      const beaten = (worldProgress[target.difficulty] ??= [])
      const first = !beaten.includes(target.zone)
      const key = `${target.world}:${target.zone}:${target.difficulty}`
      const paidToday = draft.bossFragments?.day === ctx.today ? draft.bossFragments.paid : []
      if (first || !paidToday.includes(key)) {
        loot.fragments = first ? BOSS_FIRST_FRAGMENTS : BOSS_FRAGMENTS
        draft.fragments += loot.fragments
        draft.bossFragments = { day: ctx.today, paid: [...paidToday, key] }
      }
      if (first) {
        beaten.push(target.zone)
        const diff = DIFFICULTIES[target.difficulty]
        const rng = root.fork('drops')
        const scrapBefore = draft.scrap
        if (stash(draft, rollItem(rng, { ilvl: target.def.ilvl + diff.ilvl, rarityBoost: diff.rarityBoost + 1 }))) loot.items++
        if (stash(draft, rollGem(rng))) loot.gems++
        // A support gem for sure (fase 2c), from its own stream so the item and gem stay as they were.
        if (stash(draft, rollSupport(root.fork('support')))) loot.supports++
        loot.scrap = draft.scrap - scrapBefore
        loot.xp = bossXp(target.def, target.difficulty, ctx.multiplier * (1 + boost.xp))
        draft.xp += loot.xp
        loot.levelsGained = levelsGained(draft.xp - loot.xp, draft.xp)
      }
    } else if (target.difficulty === 'inferno') {
      loot.goldLost = Math.floor(draft.gold * INFERNO_GOLD_LOSS)
      draft.gold -= loot.goldLost
    }
    const { id, sprite, element, base } = enemy
    return { fight: { ...result, enemy: { id, sprite, element, base }, loot } }
  })
  return withExtra(viewOf(hero, ctx), extra)
}
