// Glitch World's tile set. A map row is a string with one character per tile (see shared/world/maps/);
// each character here says whether the hero can stand on it and how it's drawn: an 8x8 sprite, one
// character per pixel, colored by the tile's own small palette.
export const TILE_PX = 8

const GRASS = ['#8fd17a', '#77bd63']
const FLOOR = ['#f4f5f8', '#e3e5ec']

export const TILES = {
  '.': {
    name: 'grass',
    solid: false,
    palette: { a: GRASS[0], b: GRASS[1] },
    sprite: ['aaaaaaaa', 'aabaaaaa', 'aaaaaaba', 'aaaaaaaa', 'abaaaaaa', 'aaaaabaa', 'aaaaaaaa', 'aaabaaaa'],
  },
  ':': {
    name: 'path',
    solid: false,
    palette: { a: '#e8d9b0', b: '#d4c08f' },
    sprite: ['aaaaaaaa', 'aaaabaaa', 'abaaaaaa', 'aaaaaaba', 'aaaaaaaa', 'aaabaaaa', 'aaaaaaab', 'baaaaaaa'],
  },
  _: {
    name: 'floor',
    solid: false,
    palette: { a: FLOOR[0], b: FLOOR[1] },
    sprite: ['aaaaaaab', 'aaaaaaab', 'aaaaaaab', 'bbbbbbbb', 'aaabaaaa', 'aaabaaaa', 'aaabaaaa', 'bbbbbbbb'],
  },
  O: {
    name: 'portal',
    solid: false,
    palette: { f: FLOOR[0], p: '#6a3df0', s: '#1a4fe0', w: '#ffffff' },
    sprite: ['ffppppff', 'fpsssspf', 'psswwssp', 'pswppwsp', 'pswppwsp', 'psswwssp', 'fpsssspf', 'ffppppff'],
  },
  D: {
    name: 'door',
    solid: false,
    palette: { a: '#a0683a', b: '#5e3a1e', k: '#e0a030' },
    sprite: ['bbbbbbbb', 'baaabaab', 'baaabaab', 'baaabaab', 'baaabkab', 'baaabaab', 'baaabaab', 'bbbbbbbb'],
  },
  '~': {
    name: 'water',
    solid: true,
    palette: { a: '#5b8def', b: '#3d6fd6', w: '#cfe0ff' },
    sprite: ['aaaaaaaa', 'aawwaaaa', 'awaawaab', 'aaaaaaaa', 'aaaaaaaa', 'aaaaawwa', 'baaawaaw', 'aaaaaaaa'],
  },
  T: {
    name: 'tree',
    solid: true,
    palette: { g: GRASS[0], l: '#3f8f4a', d: '#2e6e38', t: '#7a4b2a' },
    sprite: ['gglllggg', 'glllllgg', 'llldllll', 'lldlllld', 'glllldlg', 'ggddddgg', 'gggttggg', 'gggttggg'],
  },
  '^': {
    name: 'rock',
    solid: true,
    palette: { g: GRASS[0], r: '#9aa0ad', d: '#6b7080', w: '#c9ccd4' },
    sprite: ['gggggggg', 'gggrrggg', 'ggrwrrgg', 'grwrrrdg', 'grrrrddg', 'rrrrdddd', 'rddddddd', 'gggggggg'],
  },
  '#': {
    name: 'wall',
    solid: true,
    palette: { a: '#3a3c4a', b: '#2a2b36' },
    sprite: ['aaabaaab', 'aaabaaab', 'bbbbbbbb', 'abaaabaa', 'abaaabaa', 'bbbbbbbb', 'aaabaaab', 'bbbbbbbb'],
  },
  B: {
    name: 'bookshelf',
    solid: true,
    palette: { w: '#8a5a34', d: '#5e3a1e', p: '#6a3df0', s: '#1a4fe0', y: '#e0a030' },
    sprite: ['wwwwwwww', 'wpsypsyw', 'wpsypsyw', 'dddddddd', 'wysppysw', 'wysppysw', 'dddddddd', 'wwwwwwww'],
  },
  C: {
    name: 'terminal',
    solid: true,
    palette: { f: FLOOR[0], k: '#1c1d26', s: '#1a4fe0', g: '#9be7ff' },
    sprite: ['fkkkkkkf', 'fksssskf', 'fksgsskf', 'fkssgskf', 'fkkkkkkf', 'ffkkkkff', 'fkkkkkkf', 'ffffffff'],
  },
}

// Unknown characters are solid, so a typo in a map can't let the hero walk off it.
export const isSolid = (char) => TILES[char]?.solid ?? true
