// The Quadro de missões (fase 3, the "Rotina de Estudos"): 3 to 5 quests a day, the same for one user
// and day (seeded), always a hunt and an acertos quest plus some of boss, daily challenge and duel.
// Progress comes from the hero's day counters (kills per zone and boss wins, counted by the server as
// hunts settle and bosses fall) and from the day's study (acertos, dailies, duel wins in the ledger).
// Each quest is collected once; collecting them all adds a chest. Pure.
//
// The hero stores { day, level, kills: { 'world/zone': n }, bosses, taken: [quest id] }; the list itself
// is rolled again from the seed and the level frozen when the day began, so it never changes mid-day.
import { refGold, refXp } from './economy.js'
import { createRng } from './rng.js'
import { HUNT_WORLDS, ZONES } from './zones.js'

export const MIN_QUESTS = 3
export const MAX_QUESTS = 5
// About 15 minutes of hunting the zone that fits.
export const HUNT_KILLS = 150
export const ACERTO_TARGETS = [5, 10, 15]
const OPTIONAL = ['boss', 'daily', 'duel']
// Rewards in kills of the yardstick at the hero level (economy.js) plus fragments. A full day (5
// quests) pays 250 kills of gold and 300 of xp, about a third of an hour of hunting, plus 65 fragments
// and the chest: pinned against the hunt in game-economy.test.js.
export const QUEST_REWARDS = {
  hunt: { goldKills: 60, xpKills: 60, fragments: 10 },
  acertos: { goldKills: 40, xpKills: 80, fragments: 20 },
  boss: { goldKills: 50, xpKills: 50, fragments: 10 },
  daily: { goldKills: 50, xpKills: 60, fragments: 15 },
  duel: { goldKills: 50, xpKills: 50, fragments: 10 },
}
// Collecting every quest of the day adds this many chests (opened like the study chests).
export const ALL_DONE_CHESTS = 1

// Quest xp at the study multiplier that holds when it is collected, rounded down once like hunt xp.
export const questXp = (base, multiplier) => Math.floor(base * multiplier + 1e-9)

// Every hunt zone the game has, as { world, zone, minLevel }.
const defaultZones = () =>
  HUNT_WORLDS.flatMap((world) => Object.values(ZONES[world] ?? {}).map((zone) => ({ world, zone: zone.id, minLevel: zone.minLevel })))

// The zones that fit a level best: the highest suggested level at or under it (the lowest ones when
// the hero is under them all). zones: [{ world, zone, minLevel, region? }], all the game's by default;
// a town or region may pass its own.
export function huntTargets(level, zones = defaultZones()) {
  if (zones.length === 0) return []
  const open = zones.filter((zone) => zone.minLevel <= level)
  const pool = open.length > 0 ? open : zones
  const best = open.length > 0 ? Math.max(...pool.map((zone) => zone.minLevel)) : Math.min(...pool.map((zone) => zone.minLevel))
  return pool.filter((zone) => zone.minLevel === best)
}

const rewardOf = (kind, level) => {
  const reward = QUEST_REWARDS[kind]
  return { gold: Math.ceil(refGold(level) * reward.goldKills), xp: Math.floor(refXp(level) * reward.xpKills), fragments: reward.fragments }
}

const whereOf = ({ world, zone, region }) => (region ? { world, zone, region } : { world, zone })

// The day's quests: [{ id, kind, target, where? (hunt), reward: { gold, xp (before the multiplier), fragments } }].
export function dailyQuests({ userId, day, level, zones }) {
  const rng = createRng(`${userId}:quests:${day}`)
  const count = MIN_QUESTS + rng.int(MAX_QUESTS - MIN_QUESTS + 1)
  const extra = [...OPTIONAL]
  const picked = []
  while (picked.length < count - 2) picked.push(extra.splice(rng.int(extra.length), 1)[0])
  const list = []
  const targets = huntTargets(level, zones)
  if (targets.length > 0) {
    list.push({ id: 'hunt', kind: 'hunt', target: HUNT_KILLS, where: whereOf(rng.pick(targets)), reward: rewardOf('hunt', level) })
  }
  list.push({ id: 'acertos', kind: 'acertos', target: rng.pick(ACERTO_TARGETS), reward: rewardOf('acertos', level) })
  for (const kind of OPTIONAL) if (picked.includes(kind)) list.push({ id: kind, kind, target: 1, reward: rewardOf(kind, level) })
  return list
}

// The quests' day: today, unless the stored one is already on a later day (the client's date may sit a
// day either side of the server's; going back would hand out a day twice).
export const questDay = (state, today) => (state?.day && state.day > today ? state.day : today)

// The stored state on its day, or a fresh one with the level frozen.
export function questState(state, today, level) {
  if (state?.day && state.day >= today) return state
  return { day: today, level, kills: {}, bosses: 0, taken: [] }
}

export const killKey = ({ world, zone }) => `${world}/${zone}`

export function countKills(state, where, kills) {
  if (!(kills > 0)) return state
  const key = killKey(where)
  return { ...state, kills: { ...state.kills, [key]: (state.kills[key] ?? 0) + kills } }
}

export const countBoss = (state) => ({ ...state, bosses: (state.bosses ?? 0) + 1 })

const dayRow = (ledger, day) => ledger?.days?.find((row) => row.day === day) ?? {}

// How far a quest is, from the counters and the day's ledger row.
function rawProgress(quest, state, row) {
  if (quest.kind === 'hunt') return state.kills[killKey(quest.where)] ?? 0
  if (quest.kind === 'boss') return state.bosses ?? 0
  if (quest.kind === 'acertos') return row.correct ?? 0
  if (quest.kind === 'daily') return row.dailies ?? 0
  if (quest.kind === 'duel') return row.duelWins ?? 0
  return 0
}

// The board: { day, quests: [quest + progress, done, collected, reward.xp at the multiplier], bonus }.
// A stored day that is over shows as the new day with nothing counted (saved on the next write).
export function questsView({ userId, state, today, level, ledger, multiplier, zones }) {
  const active = questState(state, today, level)
  const taken = new Set(active.taken)
  const row = dayRow(ledger, active.day)
  const quests = dailyQuests({ userId, day: active.day, level: active.level, zones }).map((quest) => {
    const progress = Math.min(quest.target, rawProgress(quest, active, row))
    return {
      ...quest,
      progress,
      done: progress >= quest.target,
      collected: taken.has(quest.id),
      reward: { ...quest.reward, xp: questXp(quest.reward.xp, multiplier) },
    }
  })
  return { day: active.day, quests, bonus: { chests: ALL_DONE_CHESTS, collected: quests.every((quest) => quest.collected) } }
}
