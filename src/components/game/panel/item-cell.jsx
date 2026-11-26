import GameIcon from '../icons/game-icon.jsx'
import { iconOf } from '../item-tooltip/item-text.js'
import { RARITY_TRIM, UI } from '../ui/tokens.js'

const GEM_TRIM = '#4fd1c5'
const CELL = 'relative grid aspect-square w-full min-h-11 min-w-11 place-items-center border-2'
// A sunk square: dark bevel top-left, light bottom-right, the same as an inset Frame.
const SUNK = `inset 2px 2px 0 ${UI.bevelDark}, inset -2px -2px 0 #2a2250`

// The glow inside a filled square: two hard 2px steps of the trim color, stronger for the top
// rarities. Pixel steps, not a blur, so it stays in the game's look.
function glowOf(trim, rarity) {
  const [near, far] = rarity === 'legendary' ? [55, 22] : rarity === 'epic' ? [42, 16] : [30, 12]
  return `inset 0 0 0 2px color-mix(in srgb, ${trim} ${near}%, transparent), inset 0 0 0 4px color-mix(in srgb, ${trim} ${far}%, transparent)`
}

// One item square (bag, forge, the Hero tab's doll): its icon on a flat sunk fill tinted by the
// rarity trim (the color the hero's gear wears), a 2px trim border and a stepped inner glow. A button,
// so the whole grid is keyboard reachable. pressed: aria-pressed for multi-select; selected: the white ring.
export default function ItemCell({ item, label, selected = false, pressed, onClick, disabled = false, badge }) {
  const trim = item.kind === 'gem' ? GEM_TRIM : (RARITY_TRIM[item.rarity] ?? RARITY_TRIM.common)
  const ring = selected || pressed ? ' outline-2 outline-white' : ''
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      aria-current={selected ? 'true' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`${CELL}${ring} cursor-pointer focus-visible:outline-2 focus-visible:outline-[#f2c14e] disabled:cursor-not-allowed disabled:opacity-60`}
      style={{ borderColor: trim, backgroundColor: `color-mix(in srgb, ${trim} 10%, ${UI.inset})`, boxShadow: glowOf(trim, item.rarity) }}
    >
      <GameIcon name={iconOf(item)} size={2} />
      {item.upgrade > 0 && <b className="absolute bottom-0.5 right-1 font-pixel text-[9px] font-normal leading-none text-white [text-shadow:1px_1px_0_#120c22]">+{item.upgrade}</b>}
      {badge}
    </button>
  )
}

// An empty square: not a control, just the place, sunk into the panel. icon: a faded silhouette of
// what goes there; name: a caption under it (the doll's slot names). Without a label it is hidden
// from screen readers (the bag's free cells, whose count is said once).
export function EmptyCell({ label, icon, name }) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }
  return (
    <span {...a11y} className={`${CELL} border-[#2a2250] bg-[#100c20]`} style={{ boxShadow: SUNK }}>
      {icon && <GameIcon name={icon} size={2} className={`opacity-20 [filter:brightness(0)_invert(1)] ${name ? '-translate-y-1' : ''}`} />}
      {name && (
        <span aria-hidden="true" className="absolute inset-x-0.5 bottom-1 truncate text-center font-pixel text-[8px] leading-none text-[#9a8fd0]">
          {name}
        </span>
      )}
    </span>
  )
}
