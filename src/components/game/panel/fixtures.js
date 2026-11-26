// Test fixtures in the server View's shape (toView in server/modules/game/game.model.js).
import { heroStats, power } from '../../../../shared/game/stats.js'

const gear = (over) => ({ kind: 'gear', affixes: [], sockets: [], upgrade: 0, rerolls: 0, equipped: null, ...over })

// An epic set relic with three affixes and two sockets (one with a gem).
export const epicRelic = gear({
  id: 'aaaaaaaaaaa1',
  base: 'teclado-runico',
  slot: 'relic',
  rarity: 'epic',
  ilvl: 14,
  set: 'compilador',
  affixes: [
    { id: 'sharp', tier: 1, value: 6 },
    { id: 'brutal', tier: 1, value: 9 },
    { id: 'vital', tier: 1, value: 20 },
  ],
  sockets: ['logica', null],
  upgrade: 2,
  rerolls: 1,
})

// What the hero wears in the relic slot: no attack, so the epic relic compares at +9 attack.
export const wornRelic = gear({
  id: 'aaaaaaaaaaa2',
  base: 'pergaminho-antigo',
  slot: 'relic',
  rarity: 'common',
  ilvl: 3,
  equipped: 'relic',
})

export const wornHelm = gear({
  id: 'aaaaaaaaaaa3',
  base: 'capuz',
  slot: 'helm',
  rarity: 'rare',
  ilvl: 10,
  set: 'compilador',
  affixes: [
    { id: 'sturdy', tier: 1, value: 7 },
    { id: 'vital', tier: 1, value: 14 },
  ],
  sockets: [null],
  equipped: 'helm',
})

export const wornChest = gear({
  id: 'aaaaaaaaaaa4',
  base: 'armadura',
  slot: 'chest',
  rarity: 'epic',
  ilvl: 12,
  set: 'compilador',
  affixes: [{ id: 'hearty', tier: 1, value: 3 }],
  sockets: [null],
  equipped: 'chest',
})

export const legendarySword = gear({
  id: 'aaaaaaaaaaa5',
  base: 'espada',
  slot: 'weapon',
  rarity: 'legendary',
  ilvl: 14,
  unique: 'excalibug',
  affixes: [{ id: 'honed', tier: 1, value: 8 }],
  sockets: [null, null],
})

export const plainRing = gear({ id: 'aaaaaaaaaaa6', base: 'anel', slot: 'ring', rarity: 'uncommon', ilvl: 5, affixes: [{ id: 'swift', tier: 1, value: 4 }] })

export const gem = { id: 'aaaaaaaaaaa7', kind: 'gem', gem: 'sintaxe' }

export function makeView({ items = [epicRelic, wornRelic, wornHelm, wornChest, legendarySword, plainRing, gem], gold = 500, scrap = 40, fragments = 30, chests = [], potions = { hp: 3, mp: 1 }, hunt = null, level = 12, free = 2, correct = 14, toNextPoint = 6, talents = ['root'], skills = { owned: { golpe: 1 }, loadout: ['golpe', null, null, null] }, thresholds = { hp: 0.4, mp: 0.25 }, branch = { logica: 0, sintaxe: 0, algoritmos: 0 } } = {}) {
  const spent = talents.filter((id) => id !== 'root').length
  const stats = heroStats({ level, items: items.filter((item) => item.equipped), talents })
  return {
    hero: {
      gold,
      fragments,
      scrap,
      honor: 0,
      keys: 0,
      chests,
      potions,
      thresholds,
      talents,
      skills,
      items,
      hunt,
      progress: {},
      look: { skin: 0, hairStyle: 0, hairColor: 0, eyeStyle: 0, eyeColor: 0, outfit: 0 },
      lookSet: true,
      lastAway: null,
    },
    level: { level, xp: 3400, into: 400, needed: 900 },
    talentPoints: { total: free + spent, spent, free },
    stats,
    power: power(stats),
    zones: {
      'floresta-js': {
        normal: [
          { id: 'z1', unlocked: true, beaten: false, minLevel: 1, bossLevel: 5 },
          { id: 'z2', unlocked: false, beaten: false, minLevel: 8, bossLevel: 10 },
          { id: 'z3', unlocked: false, beaten: false, minLevel: 14, bossLevel: 14 },
        ],
        pesadelo: [],
        inferno: [],
      },
    },
    study: { today: { correct, toNextPoint }, pending: { fragments: 0, potions: 0, chests: [], keys: 0, honor: 0 }, branch },
    huntPreview: null,
  }
}

// Every action resolves to the View, as the page's bound actions do.
export function makeActions(vi, view) {
  const ok = () => vi.fn(async () => view)
  return {
    equipItem: ok(),
    unequipSlot: ok(),
    forgeUpgrade: ok(),
    forgeSalvage: ok(),
    forgeReroll: ok(),
    forgeSocket: ok(),
    openChest: ok(),
    buyPotions: ok(),
    allocateTalents: ok(),
    respecTalents: ok(),
    buySkill: ok(),
    upgradeSkill: ok(),
    saveLoadout: ok(),
  }
}
