// Jardim da Natureza: ENEM Ciências da Natureza, tier 2, north of the Library. 48x32 (fase 4), three hunt
// zones (shared/game/zones.js):
//   z1 Estufa (south east): the south road from the Library comes up into a greenhouse garden, stone
//      walkways between planter beds, glassware tables and flowers, inside a clipped hedge.
//   z2 Pântano (north east): still pools among reeds and fallen logs.
//   z3 Bosque (west column): behind a tree line, groves of old trees, stumps and mushroom rings; the west
//      road leads to the Math Tower.
// One terminal per Natureza topic: biology in the greenhouse, chemistry by the marsh, physics in the grove.
export const JARDIM_NATUREZA = {
  id: 'jardim-natureza',
  kind: 'enem',
  area: 'natureza',
  tier: 2,
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T.............TTT"......"."....................T',
    'T..........TTT.TTBwww.wwww."""""."..ww...www..BT',
    'T..TTT..s..TTT.TTBwwwwwww..""""""..wwwwwwwww..BT',
    'T..TTTT........TT..ww.w"....""""l.wwwwww...."lBT',
    'T...TT.........TT...................www"...C."BT',
    'TT.............TT........................."."""T',
    'T....m...:::::::::::::::::::::::.........."."""T',
    'T........:::::::::::::::::::::::.........l.."""T',
    'TTm.s....::....TT...C......C..::..C..l"l.."....T',
    'T...C....::.m..TTB."".........::.......".......T',
    'Tm...,,m.::...TTT."""wwwwwww..::......wwwwwww..T',
    'T.s.,,,,,::.C..TT."""wwwwwww..::...www.wwwwww..T',
    'T...,,,,.::..s.TT..l...w......::..."ww..ww....BT',
    'T........::....TTB............::.............."T',
    '::::.....::....TBBBBBBBBBBBBBB::BBBBBBBBBBBBBBBB',
    ':::::::::::....TBBBBBBBBBBBBBB::BBBBBBBBBBBBBBBB',
    ':::::::::::....TT.PPP.=*PPP...::........PPP.=..T',
    'T..............TT.....=.......::.*.......*..=.BT',
    'T..............TT==============================T',
    'T...C..sm..TT..TT.....=.......::.***...*....=..T',
    'T..........TTTTTT.PPP.=.PPP...::........PPP.=..T',
    'TTTTT.m.....T.TTT.....=.......:::::::::.*...=GGT',
    'TTTTT..........TTB..C.=...GG..:::::::::.....=.BT',
    'TTTTT..,s,.C...TTB....=*...........C.::...C.=..T',
    'T..T..,,,,.....TT==============================T',
    'T.....s,,,..T.TTT*....=.....C........::....*=..T',
    'TTs.....m..TTT.TT.PPP.=.PPP.....PPP..::..PPP=..T',
    'T...TTTTT......TTB....=.............:::.....=..T',
    'T...TTTT.......TTB....=.....*GG.....:::...C.=.BT',
    'T.m........m..TTT.....=...........*.:::.....=.BT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT:::TTTTTTTTT',
  ],
  spawn: { x: 37, y: 27 },
  roads: [
    { side: 'south', start: 36, to: 'biblioteca-linguagens' },
    { side: 'west', start: 15, to: 'torre-matematica' },
  ],
  zones: [
    { id: 'z1', rect: { x: 16, y: 16, w: 32, h: 16 } },
    { id: 'z2', rect: { x: 16, y: 0, w: 32, h: 16 } },
    { id: 'z3', rect: { x: 0, y: 0, w: 16, h: 32 } },
  ],
  npcs: [],
  terminals: [
    { x: 20, y: 23, kind: 'topic', topicId: 'biologia-ecologia' },
    { x: 28, y: 26, kind: 'topic', topicId: 'biologia-genetica-evolucao' },
    { x: 35, y: 24, kind: 'topic', topicId: 'biologia-celula' },
    { x: 42, y: 24, kind: 'topic', topicId: 'biologia-fisiologia-saude' },
    { x: 42, y: 29, kind: 'topic', topicId: 'biologia-seres-vivos' },
    { x: 20, y: 9, kind: 'topic', topicId: 'quimica-geral' },
    { x: 27, y: 9, kind: 'topic', topicId: 'quimica-fisico-quimica' },
    { x: 34, y: 9, kind: 'topic', topicId: 'quimica-organica' },
    { x: 43, y: 5, kind: 'topic', topicId: 'quimica-ambiental' },
    { x: 4, y: 10, kind: 'topic', topicId: 'fisica-mecanica' },
    { x: 12, y: 12, kind: 'topic', topicId: 'fisica-energia-termologia' },
    { x: 4, y: 20, kind: 'topic', topicId: 'fisica-eletricidade' },
    { x: 11, y: 24, kind: 'topic', topicId: 'fisica-ondas-optica' },
  ],
}
