import { BIBLIOTECA_LINGUAGENS } from './maps/biblioteca-linguagens.js'
import { CAVERNA_SQL } from './maps/caverna-sql.js'
import { CIDADE_HUMANAS } from './maps/cidade-humanas.js'
import { FLORESTA_JS } from './maps/floresta-js.js'
import { JARDIM_NATUREZA } from './maps/jardim-natureza.js'
import { LABORATORIO } from './maps/laboratorio.js'
import { TORRE_MATEMATICA } from './maps/torre-matematica.js'

// Every Glitch World region, the town first (fase 3: an open world of regions linked by roads). A region is:
// { id, kind: 'town'|'tech'|'enem', area (ENEM area id or null), tier (0 for the town, then the road
//   distance from it), rows (one character per tile, see tiles.js), spawn {x,y},
//   roads [{ side: 'west'|'east'|'north'|'south', start, to }] (a 3 tile gap in the map's edge, from
//   start along that edge; walking onto it enters region `to` at its road back, see roads.js),
//   zones [{ id: 'z1'|'z2'|'z3', rect: {x,y,w,h} }] (hunt zones; standing in one hunts there, see
//   shared/game/zones.js; tiles outside every zone are safe), npcs [{ id, x, y }] (they block their tile),
//   terminals [{x,y,kind:'topic'|'daily'|'glitchdle'|'hunt',topicId?}] }.
// Nothing is locked: study is power (XP multiplier, talent points, fragments), not a gate.
// ENEM regions only exist in pt-BR (src/components/world/enem-worlds.js closes their roads elsewhere).
// Region ids are saved with each player's position: renaming one sends those players to its spawn.
export const HUB_ID = 'laboratorio'

export const WORLDS = [LABORATORIO, FLORESTA_JS, CAVERNA_SQL, BIBLIOTECA_LINGUAGENS, CIDADE_HUMANAS, JARDIM_NATUREZA, TORRE_MATEMATICA]

export const worldById = (id) => WORLDS.find((world) => world.id === id) ?? null

// The town's NPCs (fase 3): the shops and the quest board, by the id the map and onNpc use.
export const NPC_IDS = ['merchant', 'alchemist', 'smith', 'jeweler', 'quests']
