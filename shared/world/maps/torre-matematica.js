// Torre da Matemática: ENEM Matemática, tier 3, the deepest region. 48x32 (fase 4), three hunt zones
// (shared/game/zones.js) side by side, linked by doors in the tower walls:
//   z1 Escadaria (west): the west road from the SQL Cave opens on flights of stone steps, columns along
//      the walls.
//   z2 Observatório (middle): a star mosaic under the open roof, telescopes all around it.
//   z3 Cúpula (east): a carpet under the dome, chalkboards full of formulas, columns; the east road comes
//      from the Garden of Nature.
// One terminal per Matemática topic, four in each zone.
export const TORRE_MATEMATICA = {
  id: 'torre-matematica',
  kind: 'enem',
  area: 'matematica',
  tier: 3,
  rows: [
    '################################################',
    '#______________##______________##_______E______#',
    '#_I__________I_##______Q_______##____++++++____#',
    '#______________##______________##_E__++++++__E_#',
    '#__SSSSSSSSSS__##__Q___ooo__Q__##____++++++____#',
    '#__SSSSSSSSSS__##____oooooo____##___I++++++I___#',
    '#______________##___ooooooo____##____++C+++____#',
    '#____C____C____##___oCooooCoo__##____++++++____#',
    '#_I__________I_##___ooooooooo__##____++++++____#',
    '#______________D___oooooooooo___D++++++++++__E_#',
    '#______________##__ooooooooooo_##____++++++____#',
    '#__SSSSSSSSSS__##_QooooooooooQ_##____++++++____#',
    '#__SSSSSSSSSS__##_ooooooooooo__##___I++++C+I___#',
    '#______________##_oooooooooooo_##_E__++++++____#',
    '#_I__________I_##_oooooooooooo_##____++++++____#',
    ':::____________##_oooooooooooo_##____++++++__:::',
    ':::____________##_oooooooooooo_##____++++++++:::',
    ':::____________##_oooooooooooo_##____++++++__:::',
    '#_I__________I_##_oooooooooooo_##____++++++____#',
    '#______________##_oooooooooooo_##_E_I++++++I___#',
    '#__SSSSSSSSSS__##_QooooooooooQ_##____++C+++____#',
    '#__SSSSSSSSSS__##_oooooooooooo_##____++++++____#',
    '#______________##__oooooooooo__##____++++++__E_#',
    '#______________D___ooooooooo____D++++++++++____#',
    '#_I__C____C__I_##___oCooooCo___##____++++++____#',
    '#______________##___oooooooo___##____++++++____#',
    '#______________##____oooooo____##___I++++C+I___#',
    '#__SSSSSSSSSS__##__Q__oooo__Q__##____++++++____#',
    '#__SSSSSSSSSS__##______________##_E__++++++__E_#',
    '#_I__________I_##_______Q______##____++++++____#',
    '#______________##______________##______________#',
    '################################################',
  ],
  spawn: { x: 3, y: 16 },
  roads: [
    { side: 'west', start: 15, to: 'caverna-sql' },
    { side: 'east', start: 15, to: 'jardim-natureza' },
  ],
  zones: [
    { id: 'z1', rect: { x: 0, y: 0, w: 16, h: 32 } },
    { id: 'z2', rect: { x: 16, y: 0, w: 16, h: 32 } },
    { id: 'z3', rect: { x: 32, y: 0, w: 16, h: 32 } },
  ],
  npcs: [],
  terminals: [
    { x: 5, y: 7, kind: 'topic', topicId: 'aritmetica' },
    { x: 10, y: 7, kind: 'topic', topicId: 'razao-proporcao-porcentagem' },
    { x: 5, y: 24, kind: 'topic', topicId: 'grandezas-medidas' },
    { x: 10, y: 24, kind: 'topic', topicId: 'estatistica' },
    { x: 21, y: 7, kind: 'topic', topicId: 'probabilidade-combinatoria' },
    { x: 26, y: 7, kind: 'topic', topicId: 'funcoes' },
    { x: 21, y: 24, kind: 'topic', topicId: 'progressoes-sequencias' },
    { x: 26, y: 24, kind: 'topic', topicId: 'geometria-plana' },
    { x: 39, y: 6, kind: 'topic', topicId: 'geometria-espacial' },
    { x: 41, y: 12, kind: 'topic', topicId: 'trigonometria' },
    { x: 39, y: 20, kind: 'topic', topicId: 'geometria-analitica' },
    { x: 41, y: 26, kind: 'topic', topicId: 'matematica-financeira' },
  ],
}
