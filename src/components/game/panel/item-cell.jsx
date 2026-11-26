import GameIcon from '../icons/game-icon.jsx'
import { RARITY_COLORS, iconOf } from '../item-tooltip/item-text.js'

const GEM_BORDER = '#4fd1c5'
const CELL = 'relative grid aspect-square min-h-11 min-w-11 place-items-center border-2 bg-[radial-gradient(#2a2148,#140f28)]'

// One item square (the mockup's .it): its icon on a border in the rarity color. A button, so the
// whole grid is keyboard reachable. pressed: aria-pressed for multi-select; selected: the white ring.
export default function ItemCell({ item, label, selected = false, pressed, onClick, disabled = false, badge }) {
  const border = item.kind === 'gem' ? GEM_BORDER : (RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common).border
  const glow = item.rarity === 'legendary' ? ' shadow-[0_0_10px_rgba(255,154,31,0.55)]' : ''
  const ring = selected || pressed ? ' outline-2 outline-white' : ''
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      aria-current={selected ? 'true' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`${CELL}${glow}${ring} cursor-pointer focus-visible:outline-2 focus-visible:outline-[#f2c14e] disabled:cursor-not-allowed disabled:opacity-60`}
      style={{ borderColor: border }}
    >
      <GameIcon name={iconOf(item)} size={2} />
      {item.upgrade > 0 && <b className="absolute bottom-0 right-0.5 font-label text-[9px] text-white">+{item.upgrade}</b>}
      {badge}
    </button>
  )
}

// An empty square: not a control, just the place. Without a label it is hidden from screen readers
// (the bag's free cells, whose count is said once).
export function EmptyCell({ label, icon }) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }
  return (
    <span {...a11y} className={`${CELL} border-[#2e2650]`}>
      {icon && <GameIcon name={icon} size={2} className="opacity-25" />}
    </span>
  )
}
