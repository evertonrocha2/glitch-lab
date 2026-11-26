// The town's keepers as the side panel shows them (fase 3): each one's id (the same as the map's,
// shared/world/worlds.js NPC_IDS), its accent, its icon and the look and gear its portrait wears.
// The looks match the dolls the scene draws in town (src/components/game/scene/town.js NPC_LOOKS).
export const NPC_IDS = ['merchant', 'alchemist', 'smith', 'jeweler', 'quests']

// Each keeper's own small accent on the Ardósia slate: merchant gold, alchemist sage, smith ember,
// jeweler steel blue, quest board parchment.
export const NPCS = {
  merchant: {
    accent: '#f2c14e',
    icon: 'coins',
    look: { skin: 1, hairStyle: 2, hairColor: 3, eyeStyle: 1, eyeColor: 0, outfit: 2 },
    gear: { helm: { b: 'capuz', r: 'rare' }, ring: { b: 'anel', r: 'epic' } },
  },
  alchemist: {
    accent: '#8fbf8a',
    icon: 'hppot',
    look: { skin: 3, hairStyle: 4, hairColor: 6, eyeStyle: 2, eyeColor: 2, outfit: 5 },
    gear: { weapon: { b: 'cajado', r: 'epic' }, amulet: { b: 'amuleto', r: 'rare' } },
  },
  smith: {
    accent: '#e07a45',
    icon: 'hammer',
    look: { skin: 2, hairStyle: 1, hairColor: 1, eyeStyle: 0, eyeColor: 1, outfit: 6 },
    gear: { weapon: { b: 'martelo', r: 'common' }, chest: { b: 'armadura', r: 'uncommon' } },
  },
  jeweler: {
    accent: '#6fa8dc',
    icon: 'gem',
    look: { skin: 0, hairStyle: 5, hairColor: 5, eyeStyle: 3, eyeColor: 3, outfit: 3 },
    gear: { amulet: { b: 'colar-de-logs', r: 'legendary' }, ring: { b: 'anel-de-bits', r: 'epic' } },
  },
  // The quest board is a notice board, not a person: its portrait is the board icon.
  quests: { accent: '#d8c79e', icon: 'board' },
}

export const isNpc = (id) => NPC_IDS.includes(id)

// Where opening a keeper lands in the panel: the smith is the Forge tab itself (the Ferreiro is the
// forge), every other keeper is the Cidade tab on its own view. An unknown id opens the town list.
export const npcTarget = (id) => (id === 'smith' ? { tab: 'forge', npc: null } : { tab: 'town', npc: isNpc(id) ? id : null })
