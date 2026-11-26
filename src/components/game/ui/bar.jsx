import { UI } from './tokens.js'

const clamp = (n, min, max) => Math.min(Math.max(n, min), max)

// A pixel bar (life, mana, XP, power...): ink outline, a sunk track, the fill with a light row on top
// and a dark row under it, the numbers inside. It is a meter for screen readers.
//
// Props:
// - value, max: the amount (clamped to 0..max; a missing or zero max reads as empty).
// - label: the accessible name ("Vida"). text: what shows inside (default "value / max"); pass it
//   when the numbers need locale formatting or a prefix. It is also the meter's aria-valuetext.
// - color: the fill (gold by default). segments: split the track in that many parts (0 = none).
// - tick: a value to mark with a gold notch (the suggested power). className: size (h-4 default).
export default function Bar({ value, max, label, text, color = UI.gold, segments = 0, tick, className = 'h-4' }) {
  const top = Math.max(0, Number(max) || 0)
  const now = clamp(Number(value) || 0, 0, top)
  const pct = top > 0 ? (now / top) * 100 : 0
  const at = (n) => `${clamp((n / top) * 100, 0, 100)}%`
  return (
    // biome-ignore lint/a11y/useSemanticElements: a native <meter> cannot hold the pixel fill, ticks and numbers.
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={now}
      aria-valuemin={0}
      aria-valuemax={top}
      aria-valuetext={text}
      className={`relative min-w-0 overflow-hidden border-2 border-[#120c22] bg-[#100c20] shadow-[inset_0_2px_0_#0a0818] ${className}`}
    >
      <i
        data-part="fill"
        className="absolute inset-y-0 left-0 block"
        style={{
          width: `${pct}%`,
          background: color,
          boxShadow: `inset 0 2px 0 color-mix(in srgb, ${color} 55%, white), inset 0 -2px 0 color-mix(in srgb, ${color} 60%, black)`,
        }}
      />
      {segments > 1 &&
        Array.from({ length: segments - 1 }, (_, i) => (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: the dividers are fixed positions, never reordered.
            key={i}
            data-part="divider"
            className="absolute inset-y-0 block w-0.5 bg-[#120c22]/70"
            style={{ left: `calc(${((i + 1) / segments) * 100}% - 1px)` }}
          />
        ))}
      {tick != null && top > 0 && (
        <i data-part="tick" className="absolute inset-y-0 block w-0.5 bg-[#f2c14e] shadow-[1px_0_0_#120c22,-1px_0_0_#120c22]" style={{ left: `calc(${at(tick)} - 1px)` }} />
      )}
      <span className="absolute inset-0 flex items-center justify-center font-pixel text-[10px] leading-none text-white [text-shadow:1px_1px_0_#120c22]">
        {text ?? `${now} / ${top}`}
      </span>
    </div>
  )
}
