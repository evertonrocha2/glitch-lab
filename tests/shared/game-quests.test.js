import { describe, expect, it } from 'vitest'
import { refGold, refXp } from '../../shared/game/economy.js'
import {
  ACERTO_TARGETS, ALL_DONE_CHESTS, HUNT_KILLS, MAX_QUESTS, MIN_QUESTS, QUEST_REWARDS, countBoss, countKills, dailyQuests,
  huntTargets, questDay, questState, questZones, questsView, questXp,
} from '../../shared/game/quests.js'
import { worldById } from '../../shared/world/worlds.js'
import { ZONES } from '../../shared/game/zones.js'

const DAY = '2026-11-26'
const quests = (patch = {}) => dailyQuests({ userId: 'alice', day: DAY, level: 5, ...patch })
const ledgerOf = (row) => ({ days: row ? [{ day: DAY, correct: 0, dailies: 0, duelWins: 0, ...row }] : [] })

describe('daily quests', () => {
  it('are 3 to 5 a day, the same for one user and day, and change with the day', () => {
    const counts = new Set()
    for (let at = 1; at <= 28; at++) {
      const day = `2026-11-${String(at).padStart(2, '0')}`
      const list = dailyQuests({ userId: 'alice', day, level: 5 })
      expect(list.length).toBeGreaterThanOrEqual(MIN_QUESTS)
      expect(list.length).toBeLessThanOrEqual(MAX_QUESTS)
      counts.add(list.length)
      expect(dailyQuests({ userId: 'alice', day, level: 5 })).toEqual(list)
      // Always a hunt and an acertos quest; each kind at most once (the kind is the quest id).
      expect(list.map((quest) => quest.id)).toEqual(expect.arrayContaining(['hunt', 'acertos']))
      expect(new Set(list.map((quest) => quest.id)).size).toBe(list.length)
    }
    expect([...counts].sort()).toEqual([3, 4, 5])
  })

  it('hunts HUNT_KILLS foes in a zone that fits the hero level best, and asks for 5 to 15 acertos', () => {
    const forest = ZONES['floresta-js']
    for (const level of [1, 3, forest.z2.minLevel, forest.z3.minLevel, 40, 60]) {
      const hunt = quests({ level }).find((quest) => quest.kind === 'hunt')
      expect(hunt.target).toBe(HUNT_KILLS)
      const fits = questZones().filter((zone) => zone.minLevel <= level)
      const best = Math.max(...fits.map((zone) => zone.minLevel))
      expect(ZONES[hunt.where.world][hunt.where.zone].minLevel, `level ${level}`).toBe(best)
    }
    expect(quests({ level: forest.z2.minLevel }).find((quest) => quest.kind === 'hunt').where.zone).toBe('z2')
    expect(ACERTO_TARGETS).toContain(quests().find((quest) => quest.kind === 'acertos').target)
  })

  it('never sends a hunt quest to an ENEM region, which only pt-BR readers have', () => {
    expect(questZones().length).toBeGreaterThan(0)
    for (const zone of questZones()) expect(worldById(zone.world).kind).not.toBe('enem')
  })

  it('takes the hunt zones from the caller, so a region can pass its own', () => {
    const zones = [{ world: 'caverna-sql', zone: 'c1', minLevel: 1, region: 'caverna' }]
    expect(huntTargets(5, zones)).toEqual(zones)
    expect(quests({ zones }).find((quest) => quest.kind === 'hunt').where).toEqual({ world: 'caverna-sql', zone: 'c1', region: 'caverna' })
  })

  it('pays gold, xp and fragments in kills of the yardstick at the hero level', () => {
    for (const quest of quests({ level: 12 })) {
      const reward = QUEST_REWARDS[quest.kind]
      expect(quest.reward).toEqual({
        gold: Math.ceil(refGold(12) * reward.goldKills),
        xp: Math.floor(refXp(12) * reward.xpKills),
        fragments: reward.fragments,
      })
    }
  })
})

describe('quest state', () => {
  it('starts a day with the level frozen and nothing counted, and never goes back a day', () => {
    const fresh = questState(null, DAY, 7)
    expect(fresh).toEqual({ day: DAY, level: 7, kills: {}, bosses: 0, taken: [] })
    expect(questState(fresh, DAY, 9)).toBe(fresh)
    expect(questState(fresh, '2026-11-27', 9)).toEqual({ day: '2026-11-27', level: 9, kills: {}, bosses: 0, taken: [] })
    expect(questState(fresh, '2026-11-25', 9)).toBe(fresh)
    expect(questDay(fresh, '2026-11-25')).toBe(DAY)
  })

  it('counts kills per zone and boss wins', () => {
    let state = questState(null, DAY, 5)
    state = countKills(state, { world: 'floresta-js', zone: 'z1' }, 40)
    state = countKills(state, { world: 'floresta-js', zone: 'z1' }, 25)
    state = countKills(state, { world: 'floresta-js', zone: 'z2' }, 0)
    state = countBoss(countBoss(state))
    expect(state.kills).toEqual({ 'floresta-js/z1': 65 })
    expect(state.bosses).toBe(2)
  })
})

describe('the quest board view', () => {
  it('reads each quest progress from the counters and the day study, capped at the target', () => {
    const list = quests()
    let state = questState(null, DAY, 5)
    const hunt = list.find((quest) => quest.kind === 'hunt')
    state = countKills(state, hunt.where, HUNT_KILLS + 30)
    state = countBoss(state)
    const view = questsView({ userId: 'alice', state, today: DAY, level: 5, ledger: ledgerOf({ correct: 3, dailies: 1, duelWins: 2 }), multiplier: 1.3 })
    expect(view.day).toBe(DAY)
    const byId = Object.fromEntries(view.quests.map((quest) => [quest.id, quest]))
    expect(byId.hunt).toMatchObject({ progress: HUNT_KILLS, done: true, collected: false })
    expect(byId.acertos).toMatchObject({ progress: 3, done: false })
    if (byId.boss) expect(byId.boss).toMatchObject({ progress: 1, done: true })
    if (byId.daily) expect(byId.daily).toMatchObject({ progress: 1, done: true })
    if (byId.duel) expect(byId.duel).toMatchObject({ progress: 1, done: true })
    // xp shows what claiming pays now: the study multiplier applies, like hunt xp.
    expect(byId.hunt.reward.xp).toBe(questXp(hunt.reward.xp, 1.3))
    expect(view.bonus).toEqual({ chests: ALL_DONE_CHESTS, collected: false })
  })

  it('shows a fresh day with nothing counted when the stored one is over', () => {
    const old = countKills(questState(null, '2026-11-25', 5), { world: 'floresta-js', zone: 'z1' }, 500)
    const view = questsView({ userId: 'alice', state: { ...old, taken: ['hunt'] }, today: DAY, level: 5, ledger: ledgerOf(null), multiplier: 1 })
    expect(view.day).toBe(DAY)
    for (const quest of view.quests) expect(quest).toMatchObject({ progress: 0, done: false, collected: false })
  })

  it('marks collected quests, and the bonus once all of them are', () => {
    const list = quests()
    const state = { ...questState(null, DAY, 5), taken: list.map((quest) => quest.id) }
    const view = questsView({ userId: 'alice', state, today: DAY, level: 5, ledger: ledgerOf(null), multiplier: 1 })
    for (const quest of view.quests) expect(quest.collected).toBe(true)
    expect(view.bonus.collected).toBe(true)
  })
})
