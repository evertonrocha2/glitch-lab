// The hero's colors. Every material is four tones, darkest first: the painter picks one per pixel
// from the light (top left), so a part only names its material.

export const INK = '#120c22'

export const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 }

// Rarity drives the look of each piece: trim (edges, accents), metal, cloth, gem and blade.
export const BY_R = {
  trim: {
    common: ['#4a4e5c', '#8a8fa0', '#c9ccd4', '#ffffff'],
    uncommon: ['#145a32', '#2fae5f', '#6fe39a', '#d2ffe3'],
    rare: ['#123a8a', '#2f7ae0', '#6fb4ff', '#d6ecff'],
    epic: ['#3a1a8a', '#8a5cff', '#c3a6ff', '#efe6ff'],
    legendary: ['#8a3a00', '#ff9a1f', '#ffc04a', '#fff1b0'],
  },
  metal: {
    common: ['#33353f', '#5e626f', '#8a8e9c', '#b4b8c4'],
    uncommon: ['#34404a', '#677a86', '#a3b4be', '#dbe6ec'],
    rare: ['#3b4257', '#7d88a3', '#c3cbe0', '#ffffff'],
    epic: ['#2a1a50', '#5a4690', '#8e7ad0', '#cfc2ff'],
    legendary: ['#4a4e6e', '#a9b0cc', '#e4e9f6', '#ffffff'],
  },
  cloth: {
    common: ['#3e3022', '#6e5a40', '#97805c', '#bba37a'],
    uncommon: ['#0f3e22', '#237a40', '#3aa85a', '#86d89a'],
    rare: ['#10265e', '#1f55c8', '#4f8fff', '#bcd8ff'],
    epic: ['#2a1066', '#5a2fd9', '#8a5cff', '#c3a6ff'],
    legendary: ['#4e0a14', '#9c1426', '#d02a3a', '#ff7a7a'],
  },
  gem: {
    common: ['#4a4e5c', '#a9adbd', '#e3e5ec', '#ffffff'],
    uncommon: ['#0f4a2a', '#1f8a4c', '#5fd38a', '#d2ffe3'],
    rare: ['#10265e', '#1f55c8', '#4fa3ff', '#cfe6ff'],
    epic: ['#2a1066', '#7a3df0', '#b48cff', '#f0e6ff'],
    legendary: ['#7a1e00', '#e0521a', '#ffb02e', '#fff3b0'],
  },
  blade: {
    common: ['#3a3c46', '#7a7e8c', '#a9adb9', '#cfd2da'],
    uncommon: ['#34404a', '#7f93a0', '#b9cad4', '#e8f2f6'],
    rare: ['#3b4257', '#8f9ab5', '#d0d8ec', '#ffffff'],
    epic: ['#1a1030', '#4a3a7a', '#8a76c8', '#d8ccff'],
    legendary: ['#a8701a', '#f2c14e', '#fff1b0', '#ffffff'],
  },
}

// Fixed materials, plus every rarity material as `kind.rarity` (e.g. `metal.epic`).
export const MAT = {
  pants: ['#16141f', '#2b2d3a', '#43465a', '#5e6278'],
  leather: ['#3f2418', '#6e4026', '#9a6038', '#c48654'],
  shoe: ['#1a1420', '#33283a', '#4e4058', '#6a5a76'],
  wood: ['#4a2a16', '#7a4b2a', '#a8703f', '#d79b62'],
  gold: ['#7a4a12', '#c98a1c', '#f2c14e', '#fff1b0'],
  paper: ['#7a6a4a', '#c9b78f', '#efe3c2', '#fffaf0'],
  dark: ['#120c22', '#2a2440', '#4a4266', '#7a72a0'],
  hoodie: ['#191926', '#2c2e40', '#44475e', '#60647e'],
  white: ['#7d8299', '#cfd2de', '#eef0f6', '#ffffff'],
  bone: ['#5b5346', '#a59a86', '#e8e0cc', '#ffffff'],
}
for (const kind of Object.keys(BY_R)) for (const r of Object.keys(BY_R[kind])) MAT[`${kind}.${r}`] = BY_R[kind][r]

// The look options, in the order of LOOK_OPTIONS (shared/game/look.js). Names live in i18n.
export const SKIN = [
  { t: ['#c98f78', '#f6d2b8', '#ffe8d6', '#fff6ee'], blush: '#f4a0a0', mouth: '#8a3040' },
  { t: ['#b8785a', '#ecb894', '#f9d2b0', '#ffe6cc'], blush: '#e88a7c', mouth: '#7a2a34' },
  { t: ['#8a5636', '#c98c60', '#e0a77a', '#f2c49a'], blush: '#d8705e', mouth: '#5e1e22' },
  { t: ['#5a321e', '#94603e', '#b47a52', '#cf9668'], blush: '#c0604a', mouth: '#3a1410' },
  { t: ['#2e180e', '#5e3822', '#7e5032', '#9c6a44'], blush: '#a04a36', mouth: '#24100a' },
]
export const HAIR = [
  ['#3e2414', '#6b4022', '#9a6038', '#c48654'],
  ['#120c1c', '#2a2236', '#463a58', '#6e6088'],
  ['#a8701a', '#e0a030', '#f2c14e', '#fff1b0'],
  ['#6e1e0e', '#b8401e', '#e0682a', '#ffa060'],
  ['#5e5c78', '#a9a6bd', '#dcdbe8', '#ffffff'],
  ['#152c6e', '#2f5ec8', '#4f8fff', '#a8ceff'],
  ['#8a2a5e', '#d0508f', '#ff7ab8', '#ffc2df'],
  ['#14502a', '#2a8a46', '#4fbf6a', '#a8eeb0'],
]
export const OUTFIT = [
  ['#0c2470', '#1a4fe0', '#4a7dff', '#9ab8ff'],
  ['#4e0e16', '#9c1f2c', '#d0343f', '#ff7a7f'],
  ['#0f3e22', '#237a40', '#3aa85a', '#86d89a'],
  ['#3e2010', '#7a4824', '#a8703f', '#d49a62'],
  ['#2a1066', '#5a2fd9', '#8a5cff', '#c3a6ff'],
  ['#22232e', '#454860', '#6a6e88', '#9ea2bd'],
  ['#6a2a08', '#c45a1a', '#f0842e', '#ffbe7a'],
  ['#7d8299', '#c9ccd8', '#eceef4', '#ffffff'],
]
// Iris dark and light.
export const EYES = [
  { i: '#5a321a', I: '#b07040' },
  { i: '#1f55c8', I: '#6fb4ff' },
  { i: '#1f7a44', I: '#6fe39a' },
  { i: '#5a2fd9', I: '#c3a6ff' },
]

// Style ids, indexed by look.eyeStyle and look.hairStyle. 'dor' and 'morte' are pose-only faces.
export const EYE_STYLES = ['redondo', 'brilho', 'determinado', 'feliz']
export const HAIR_STYLES = ['curto', 'espetado', 'longo', 'rabo', 'cacheado', 'raspado']
