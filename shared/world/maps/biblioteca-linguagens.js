// Biblioteca das Linguagens: ENEM Linguagens, tier 1, east of the town. 48x32 (fase 4), three hunt zones
// (shared/game/zones.js), each its own room behind thick walls, linked by doors:
//   z1 Estantes (west column): the west road from the town opens on a reading room, rows of shelves either
//      side of a red runner; a door east leads to the archive.
//   z2 Arquivo (south east): short stacks of index cabinets and barrels of old scrolls; a door north leads
//      to the crypt.
//   z3 Cripta (north east): mossy flagstones, two colonnades, bones and fallen stones; the north road
//      climbs to the Garden of Nature.
// One terminal per Linguagens topic, spread over the three rooms.
export const BIBLIOTECA_LINGUAGENS = {
  id: 'biblioteca-linguagens',
  kind: 'enem',
  area: 'linguagens',
  tier: 1,
  rows: [
    '######################################:::#######',
    '##_____________###___x_______=r__=_=__:::______#',
    '#______++______###RR____=_======_=_=_=________##',
    '#_BBBB_++_BBBB_##_____================_==_____x#',
    '#______++______##_r_I=_=I===I=====I======_==I_##',
    '#__C___++___C__##===========================___#',
    '#______++_____###=_==========================__#',
    '#_BBBB_++_BBBB_##=====C=========C=========C====#',
    '##_____++______##_=============================#',
    '#______++______##_============================_#',
    '#______++______##___======r=====x=r=====r=====##',
    '#_BBBB_++_BBBB###_==I==xI===I=====I=========I__#',
    '##_____++______##_=__====x================_r__x#',
    '#______++______##_x=_=====RR=r===========__=_R_#',
    ':::++++++++++++##_________==x_===r====_________#',
    ':::++++++++++++################D################',
    ':::++++++++++++################_################',
    '#______++______##______________________________#',
    '#______++______##______________________________#',
    '#_BBBB_++_BBBB_##__FFFF___FFF_______FFFF_b_____#',
    '#______++_____####_________________________FF_##',
    '#__C___++___C_###______________________________#',
    '#______++______###______C________C_____b_______#',
    '#_BBBB_++_BBBB_##____b____________________C____#',
    '#______++______D____________b__________________#',
    '#______++______##_____________FFFF_b___________#',
    '#______++_____###____FFF_______________________#',
    '#_BBBB_++_BBBB_##______________________FFFF__b_#',
    '#______++______##__b________________b__________#',
    '##_____++______###___b____b_______b________b___#',
    '#______________##______________________________#',
    '################################################',
  ],
  spawn: { x: 3, y: 15 },
  roads: [
    { side: 'west', start: 14, to: 'laboratorio' },
    { side: 'north', start: 38, to: 'jardim-natureza' },
  ],
  zones: [
    { id: 'z1', rect: { x: 0, y: 0, w: 16, h: 32 } },
    { id: 'z2', rect: { x: 16, y: 16, w: 32, h: 16 } },
    { id: 'z3', rect: { x: 16, y: 0, w: 32, h: 16 } },
  ],
  npcs: [],
  terminals: [
    { x: 3, y: 5, kind: 'topic', topicId: 'interpretacao-texto' },
    { x: 12, y: 5, kind: 'topic', topicId: 'generos-textuais' },
    { x: 3, y: 21, kind: 'topic', topicId: 'variacao-linguistica' },
    { x: 12, y: 21, kind: 'topic', topicId: 'gramatica-funcoes-linguagem' },
    { x: 24, y: 22, kind: 'topic', topicId: 'literatura' },
    { x: 33, y: 22, kind: 'topic', topicId: 'artes' },
    { x: 42, y: 23, kind: 'topic', topicId: 'educacao-fisica' },
    { x: 22, y: 7, kind: 'topic', topicId: 'tecnologias-comunicacao' },
    { x: 32, y: 7, kind: 'topic', topicId: 'lingua-inglesa' },
    { x: 42, y: 7, kind: 'topic', topicId: 'lingua-espanhola' },
  ],
}
