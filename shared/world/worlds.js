import { BIBLIOTECA_LINGUAGENS } from './maps/biblioteca-linguagens.js'
import { CAVERNA_SQL } from './maps/caverna-sql.js'
import { CIDADE_HUMANAS } from './maps/cidade-humanas.js'
import { FLORESTA_JS } from './maps/floresta-js.js'
import { JARDIM_NATUREZA } from './maps/jardim-natureza.js'
import { LABORATORIO } from './maps/laboratorio.js'
import { TORRE_MATEMATICA } from './maps/torre-matematica.js'

// Every Glitch World map, hub first. A world is:
// { id, kind: 'hub'|'tech'|'enem', area (ENEM area id or null), requirement (to open its portal, or
//   null), rows (one character per tile, see tiles.js), spawn {x,y}, portals [{x,y,to,at:{x,y}}],
//   zones [{ id: 'z2'|'z3', rect: {x,y,w,h}, requirement }] (tiles outside them are zone 1, always
//   open), terminals [{x,y,kind:'topic'|'daily'|'glitchdle'|'hunt',topicId?}] }.
// A requirement is { signal: 'enemCorrect'|'codeSolved', area?, count } (see unlocks.js).
// World ids are saved with each player's position: renaming one sends those players to the hub.
export const HUB_ID = 'laboratorio'

export const WORLDS = [LABORATORIO, FLORESTA_JS, CAVERNA_SQL, BIBLIOTECA_LINGUAGENS, CIDADE_HUMANAS, JARDIM_NATUREZA, TORRE_MATEMATICA]

export const worldById = (id) => WORLDS.find((world) => world.id === id) ?? null
