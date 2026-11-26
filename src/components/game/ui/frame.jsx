import { TONES, UI } from './tokens.js'

// The game's box: a 2px ink outline with stepped corners and a 2px bevel (light top-left, dark
// bottom-right; inset swaps them). The fill and the outline are drawn by ::before / ::after
// (`.gw-frame` in src/index.css), so children are never clipped and the outline stays on top.
//
// Props:
// - as: the element to render ('div' by default; 'button', 'section', 'li'...).
// - tone: 'panel' | 'raised' | 'inset' | 'gold' (unknown falls back to panel).
// - className: layout and padding. Give it at least 4px of padding: outline and bevel take 4px.
//   A child that must sit above the outline (a corner badge) needs z-10.
// - anything else (type, role, aria-*, onClick, ref...) goes to the element.
export default function Frame({ as: Tag = 'div', tone = 'panel', className = '', style, children, ...rest }) {
  const key = Object.hasOwn(TONES, tone) ? tone : 'panel'
  const { bg, hi, lo } = TONES[key]
  return (
    <Tag data-tone={key} className={`gw-frame ${className}`} style={{ '--f-bg': bg, '--f-hi': hi, '--f-lo': lo, '--f-ink': UI.ink, ...style }} {...rest}>
      {children}
    </Tag>
  )
}

const CHIP = {
  gold: 'bg-[#f2c14e] text-[#120c22]',
  danger: 'bg-[#ff5a6e] text-white',
  muted: 'bg-[#2a2250] text-[#e9e4ff]',
  ink: 'bg-[#120c22] text-[#e9e4ff]',
}

// A small pixel tag: a key hint, a count badge, a level. tone: 'gold' | 'danger' | 'muted' | 'ink'.
export function Chip({ tone = 'muted', className = '', children, ...rest }) {
  return (
    <span className={`inline-flex items-center border-2 border-[#120c22] px-1 py-px font-pixel text-[9px] font-bold leading-none ${CHIP[tone] ?? CHIP.muted} ${className}`} {...rest}>
      {children}
    </span>
  )
}

// A block heading inside a panel: pixel caps in gold-muted, with a bevelled rule running to the
// right edge. level: the heading level (3 by default). id: for aria-labelledby.
export function SectionTitle({ level = 3, id, className = '', children }) {
  const Heading = `h${level}`
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Heading id={id} className="m-0 shrink-0 font-pixel text-[10px] font-normal uppercase tracking-[0.08em] text-[#d8b45a]">
        {children}
      </Heading>
      <i aria-hidden="true" className="block h-1 min-w-4 flex-1 border-y-2 border-t-[#0a0818] border-b-[#3e3170]" />
    </div>
  )
}
