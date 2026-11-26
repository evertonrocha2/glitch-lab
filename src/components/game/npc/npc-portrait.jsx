import { HeroCanvas } from '../hero/hero-canvas.jsx'
import GameIcon from '../icons/game-icon.jsx'
import Frame from '../ui/frame.jsx'
import { NPCS } from './npcs.js'

// A keeper's pixel bust: the hero painter's head crop in the keeper's own look and gear, on a backdrop
// tinted by its accent with a counter rail under it; the quest board shows its board icon instead.
// The frame's bevel wears the accent. scale: 2 (48px, the town list) or 3 (72px, a keeper's own view).
// Decorative: the name always sits next to it.
export default function NpcPortrait({ id, scale = 2, className = '' }) {
  const npc = NPCS[id]
  if (!npc) return null
  const px = 24 * scale
  return (
    <Frame
      tone="inset"
      aria-hidden="true"
      data-npc={id}
      className={`grid shrink-0 place-items-center p-1 ${className}`}
      style={{
        '--f-hi': `color-mix(in srgb, ${npc.accent} 70%, #0e1116)`,
        '--f-lo': `color-mix(in srgb, ${npc.accent} 30%, #0e1116)`,
        '--f-bg': `color-mix(in srgb, ${npc.accent} 14%, #171b23)`,
      }}
    >
      <span className="relative block overflow-hidden" style={{ width: px, height: px }}>
        {npc.look ? (
          <HeroCanvas look={npc.look} gear={npc.gear} crop="head" scale={scale} className="block" />
        ) : (
          <span className="grid size-full place-items-center">
            <GameIcon name={npc.icon} size={scale} />
          </span>
        )}
        <i className="absolute inset-x-0 bottom-0 block h-1" style={{ background: `color-mix(in srgb, ${npc.accent} 45%, #0e1116)` }} />
      </span>
    </Frame>
  )
}
