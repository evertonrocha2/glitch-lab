// Cidade do Laboratório: the central town every player starts in, and the only safe region (no hunt
// zones). 36x24 inside a town wall: the old Lab is the hall up north, four shops sit at the corners of
// the streets with their keepers in front (npcs), the quest board stands by the fountain, and study
// terminals are spread over the squares. Gates: west to the Forest, east to the Library, south to the
// City of Humanities (the last two are ENEM regions, closed outside pt-BR).
export const LABORATORIO = {
  id: 'laboratorio',
  kind: 'town',
  area: null,
  tier: 0,
  rows: [
    '####################################',
    '#TT..__________________________..TT#',
    '#T..._______############_______...T#',
    '#...._______############_______....#',
    '#___######__############__######___#',
    '#___######__#####DD#####__######___#',
    '#___##D###________________###D##___#',
    '#__________C____________C__________#',
    '#__________________________________#',
    '#_____________T......T_____________#',
    '#__T___T______.______.____T___T____#',
    ':::::::::::::::_~~~~_:::::::::::::::',
    ':::::::::::::::_~~~~_:::::::::::::::',
    ':::::::::::::::______:::::::::::::::',
    '#__T___T______B.:::..B____T___T____#',
    '#_______________:::________________#',
    '#____________C__:::___C____________#',
    '#___##D###_C____:::_____C_###D##___#',
    '#___######______:::_______######___#',
    '#___######______:::_______######___#',
    '#....___________:::____________....#',
    '#T...___________:::____________...T#',
    '#TT..___________:::____________..TT#',
    '################:::#################',
  ],
  spawn: { x: 16, y: 8 },
  roads: [
    { side: 'west', start: 11, to: 'floresta-js' },
    { side: 'east', start: 11, to: 'biblioteca-linguagens' },
    { side: 'south', start: 16, to: 'cidade-humanas' },
  ],
  zones: [],
  npcs: [
    { id: 'merchant', x: 8, y: 7 },
    { id: 'alchemist', x: 27, y: 7 },
    { id: 'smith', x: 8, y: 16 },
    { id: 'jeweler', x: 27, y: 16 },
    { id: 'quests', x: 18, y: 8 },
  ],
  terminals: [
    { x: 11, y: 7, kind: 'daily' },
    { x: 24, y: 7, kind: 'glitchdle' },
    { x: 13, y: 16, kind: 'hunt' },
    { x: 22, y: 16, kind: 'daily' },
    { x: 11, y: 17, kind: 'glitchdle' },
    { x: 24, y: 17, kind: 'hunt' },
  ],
}
