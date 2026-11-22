// O Laboratório: the hub every player starts in. 15x10, so it fits a desktop screen whole and every
// portal shows from the start: the tech worlds on top, the ENEM worlds below. No zones, no terminals.
// A portal lands on its world's spawn.
export const LABORATORIO = {
  id: 'laboratorio',
  kind: 'hub',
  area: null,
  requirement: null,
  rows: [
    '###############',
    '#_O____O____O_#',
    '#_:____:____:_#',
    '#_:::::::::::_#',
    '#_B____:____B_#',
    '#______:______#',
    '#_:::::::::::_#',
    '#_:____:____:_#',
    '#_O____O____O_#',
    '###############',
  ],
  spawn: { x: 7, y: 5 },
  portals: [
    { x: 2, y: 1, to: 'floresta-js', at: { x: 3, y: 10 } },
    { x: 7, y: 1, to: 'caverna-sql', at: { x: 3, y: 10 } },
    { x: 12, y: 1, to: 'biblioteca-linguagens', at: { x: 3, y: 10 } },
    { x: 2, y: 8, to: 'cidade-humanas', at: { x: 3, y: 10 } },
    { x: 7, y: 8, to: 'jardim-natureza', at: { x: 3, y: 10 } },
    { x: 12, y: 8, to: 'torre-matematica', at: { x: 3, y: 10 } },
  ],
  zones: [],
  terminals: [],
}
