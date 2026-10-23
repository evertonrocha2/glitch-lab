import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// A 9x9 pixel medal on a ribbon: "#" is ink, "o" the metal, "r" the ribbon, "*" a shine.
const ROWS = ['.rr...rr.', '..rr.rr..', '...rrr...', '..#####..', '.#oo*oo#.', '.#o*ooo#.', '.#ooooo#.', '.#ooooo#.', '..#####..']

// Gold, silver and bronze, plus the purple and blue ribbons of the app.
const METALS = {
  1: { metal: '#f2b705', shine: '#fff3b0', ribbon: 'var(--color-primary)' },
  2: { metal: '#b4bccb', shine: '#f1f3f7', ribbon: 'var(--color-secondary)' },
  3: { metal: '#c87a3f', shine: '#f3c9a3', ribbon: 'var(--color-primary)' },
}
const FILL = { '#': 'var(--color-ink)' }

export default function Medal({ place, className = 'size-8', label = true }) {
  const t = useT()
  const colors = METALS[place] ?? METALS[3]
  const fill = { ...FILL, o: colors.metal, '*': colors.shine, r: colors.ribbon }
  return (
    <svg
      viewBox="0 0 9 9"
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label ? t(`events.place.${place}`) : undefined}
      aria-hidden={label ? undefined : 'true'}
      className={`shrink-0 ${className}`}
    >
      {ROWS.flatMap((row, y) =>
        [...row].map((cell, x) => (fill[cell] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" style={{ fill: fill[cell] }} /> : null)),
      )}
    </svg>
  )
}
