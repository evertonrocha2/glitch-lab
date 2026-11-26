// Glitch World's tile set. A map row is a string with one character per tile (see shared/world/maps/);
// each character here says whether the hero can stand on it and how it's drawn: an 8x8 sprite, one
// character per pixel, colored by the tile's own small palette. The scene draws its own 16px art per
// character (src/components/game/scene/tiles.js).
//
// Fase 4 decoration tiles, so each hunt zone looks like its own place (calm Ardosia colors, no neon):
//   walkable: * flowers    " tall grass   , dark ground   m mushrooms   x bones    r rubble
//             = moss stone + carpet       S stairs        o mosaic
//   solid:    s stump      l log          K crystal       R ruin wall   I column   G glassware
//             w marsh water               F cabinet       M market stall          b barrel
//             P planter    Q telescope    E chalkboard
// (B, the bookshelf, was already here: a bookshelf on floors, a bush outdoors.)
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
  '*': {
    name: 'flowers',
    solid: false,
    palette: { a: GRASS[0], b: GRASS[1], p: '#d9a7b8', y: '#e6d38a', w: '#eceff4' },
    sprite: ['aaaaaaaa', 'apaaayaa', 'pypaaaaa', 'apaaaawa', 'aabaawyw', 'aaaaaawa', 'aayaaaaa', 'aaaaabaa'],
  },
  '"': {
    name: 'tall grass',
    solid: false,
    palette: { a: GRASS[0], b: GRASS[1], d: '#4f8a46' },
    sprite: ['aaaaaaaa', 'abaaabaa', 'adbaadba', 'adbadbba', 'dbdadbda', 'dbddbdda', 'ddddddda', 'aaaaaaaa'],
  },
  ',': {
    name: 'dark ground',
    solid: false,
    palette: { a: '#4a4238', b: '#3d362e', c: '#5a5146' },
    sprite: ['aaaaaaaa', 'aabaaaca', 'aaaaaaaa', 'acaaabaa', 'aaaaaaaa', 'aaabaaaa', 'baaaaaca', 'aaaaaaaa'],
  },
  m: {
    name: 'mushrooms',
    solid: false,
    palette: { a: '#4a4238', r: '#a86a5c', w: '#e8dfd0', s: '#cbbfa8' },
    sprite: ['aaaaaaaa', 'aarraaaa', 'arwrraaa', 'aassaarr', 'aassarwr', 'aaaaaass', 'arraaass', 'asswaaaa'],
  },
  x: {
    name: 'bones',
    solid: false,
    palette: { a: '#6e687f', w: '#d8d2c2', d: '#a59d8a' },
    sprite: ['aaaaaaaa', 'awaaaaaa', 'aawaaawa', 'aaawwwaa', 'aaawdaaa', 'aawaawaa', 'awaaaada', 'aaaaaaaa'],
  },
  r: {
    name: 'rubble',
    solid: false,
    palette: { a: '#8d879f', d: '#5c5770', l: '#a39db6' },
    sprite: ['aaaaaaaa', 'aldaaaaa', 'addaalaa', 'aaaaddaa', 'aaaaaaaa', 'alaaaald', 'ddaaaadd', 'aaaaaaaa'],
  },
  '=': {
    name: 'moss stone',
    solid: false,
    palette: { a: '#7d8291', d: '#5e6372', g: '#6f8a5a' },
    sprite: ['aaadaaaa', 'agadaaga', 'ggadaaaa', 'dddddddd', 'aaaaadaa', 'aagaadag', 'aaggadaa', 'dddddddd'],
  },
  '+': {
    name: 'carpet',
    solid: false,
    palette: { a: '#7a3e46', b: '#5e2f36', y: '#c9a85a' },
    sprite: ['yyyyyyyy', 'yaaaaaay', 'yabaabay', 'yaabbaay', 'yaabbaay', 'yabaabay', 'yaaaaaay', 'yyyyyyyy'],
  },
  S: {
    name: 'stairs',
    solid: false,
    palette: { a: '#a39db6', d: '#5c5770', m: '#8d879f' },
    sprite: ['aaaaaaaa', 'mmmmmmmm', 'dddddddd', 'aaaaaaaa', 'mmmmmmmm', 'dddddddd', 'aaaaaaaa', 'mmmmmmmm'],
  },
  o: {
    name: 'mosaic',
    solid: false,
    palette: { a: '#3e4a66', b: '#33405a', y: '#c9a85a', s: '#7d93b8' },
    sprite: ['abababab', 'babysbab', 'abayyaba', 'bsyyyysb', 'abayyaba', 'babysbab', 'abababab', 'babababa'],
  },
  s: {
    name: 'stump',
    solid: true,
    palette: { g: '#4a4238', t: '#7a5a3e', d: '#4f3826', r: '#b08c62' },
    sprite: ['gggggggg', 'gggggggg', 'ggttttgg', 'gtrrrrtg', 'gtrddrtg', 'gttttttg', 'gdttttdg', 'gggggggg'],
  },
  l: {
    name: 'log',
    solid: true,
    palette: { g: GRASS[0], t: '#7a5a3e', d: '#4f3826', r: '#b08c62' },
    sprite: ['gggggggg', 'gggggggg', 'gtttttrg', 'tdtttdrr', 'tttdttrr', 'gdddddrg', 'gggggggg', 'gggggggg'],
  },
  K: {
    name: 'crystal',
    solid: true,
    palette: { f: '#6e687f', c: '#8fb3d9', l: '#d4e4f4', d: '#4f6f99' },
    sprite: ['fffcffff', 'ffclcfff', 'ffcldfcf', 'fcclddcl', 'fccldcld', 'fcdddcdd', 'ffdddddf', 'ffffffff'],
  },
  R: {
    name: 'ruin wall',
    solid: true,
    palette: { f: '#8d879f', a: '#6b6880', d: '#4b4860', g: '#6f8a5a' },
    sprite: ['ffffffff', 'faaaffff', 'aaagaaff', 'ddddddaf', 'aaadaaaa', 'agadagaa', 'dddddddd', 'aaadaaad'],
  },
  I: {
    name: 'column',
    solid: true,
    palette: { f: '#8d879f', a: '#c8c3b4', d: '#8e8a7c', k: '#5c5770' },
    sprite: ['kaaaaaak', 'fkkkkkkf', 'ffadadff', 'ffadadff', 'ffadadff', 'ffadadff', 'fkkkkkkf', 'kaaaaaak'],
  },
  G: {
    name: 'glassware',
    solid: true,
    palette: { f: '#8d879f', t: '#7a5a3e', d: '#4f3826', g: '#a8c4cc', l: '#8fb39a', y: '#c9a85a' },
    sprite: ['ffffffff', 'ffgffgff', 'fgggfgff', 'fglgyyff', 'tttttttt', 'dddddddd', 'fdffffdf', 'fdffffdf'],
  },
  w: {
    name: 'marsh water',
    solid: true,
    palette: { a: '#3f5a55', b: '#344b47', l: '#6f8a5a', w: '#8fa8a2' },
    sprite: ['aaaaaaaa', 'aawwaaaa', 'aaaaalla', 'abaaalla', 'aaaaaaaa', 'allaaawa', 'allaaaaa', 'aaaabaaa'],
  },
  F: {
    name: 'cabinet',
    solid: true,
    palette: { w: '#6e5a48', d: '#3f3228', k: '#c9a85a' },
    sprite: ['dddddddd', 'dwwwwwwd', 'dwwkkwwd', 'dddddddd', 'dwwwwwwd', 'dwwkkwwd', 'dddddddd', 'dwwwwwwd'],
  },
  M: {
    name: 'market stall',
    solid: true,
    palette: { r: '#a8645a', w: '#e2dacb', t: '#7a5a3e', y: '#c9a85a', g: '#6f8a5a', f: '#b0a48c' },
    sprite: ['rwrwrwrw', 'rwrwrwrw', 'ffffffff', 'fygyrgyf', 'tttttttt', 'tffffftt', 'tffffftf', 'ffffffff'],
  },
  b: {
    name: 'barrel',
    solid: true,
    palette: { f: '#b0a48c', t: '#8a6a48', d: '#5a4330', k: '#4b4f5c' },
    sprite: ['ffffffff', 'ffddddff', 'fdttttdf', 'fkkkkkkf', 'fdttttdf', 'fkkkkkkf', 'fdttttdf', 'ffddddff'],
  },
  P: {
    name: 'planter',
    solid: true,
    palette: { f: '#8d879f', t: '#7a5a3e', d: '#4f3826', g: '#5d8a4e', p: '#d9a7b8', y: '#e6d38a' },
    sprite: ['ffffffff', 'fgpggygf', 'gpggpggg', 'gggyggpg', 'tttttttt', 'tdtdtdtd', 'tttttttt', 'ffffffff'],
  },
  Q: {
    name: 'telescope',
    solid: true,
    palette: { f: '#3e4a66', s: '#8d9ab3', d: '#4b4f5c', y: '#c9a85a' },
    sprite: ['ffffffss', 'fffffssf', 'ffffssff', 'fffysfff', 'ffddffff', 'fdffdfff', 'dfffdfff', 'ffffffff'],
  },
  E: {
    name: 'chalkboard',
    solid: true,
    palette: { t: '#7a5a3e', b: '#2f3a36', w: '#d8dcd6', f: '#8d879f' },
    sprite: ['tttttttt', 'tbbbbbbt', 'tbwwbwbt', 'tbbbbbbt', 'tbwbwwbt', 'tbbbbbbt', 'tttttttt', 'ftffftff'],
  },
}

// Unknown characters are solid, so a typo in a map can't let the hero walk off it.
export const isSolid = (char) => TILES[char]?.solid ?? true
