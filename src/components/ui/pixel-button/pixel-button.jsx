// The kit button (src/index.css .kit-btn): a pixel bevel lit from the top left on a hard drop; it
// lifts on hover and sinks when pressed, the bevel flipping. Disabled, it sits flat in the panel.
const BASE =
  'kit-btn items-center justify-center gap-2 border-2 border-void font-label tracking-wide disabled:cursor-not-allowed'

// Default size. A className that sets its own padding or text size replaces these: Tailwind applies
// whichever class comes later in its stylesheet, not in the class list, so both can't be kept.
const SIZE = [
  // Display too: a className with "hidden sm:inline-flex" must be able to hide the button.
  { test: /(^|\s)(hidden|block|inline-block|flex|grid)(\s|$)/, value: 'inline-flex' },
  { test: /(^|\s)(sm:|md:|lg:)?(px|p)-/, value: 'px-4' },
  { test: /(^|\s)(sm:|md:|lg:)?(py|p)-/, value: 'py-2.5' },
  { test: /(^|\s)(sm:|md:|lg:)?text-(\[|xs|sm|base|lg|xl)/, value: 'text-xs' },
  // At least 40px tall, so every button is an easy tap on a phone. A className with min-h-* opts out.
  { test: /(^|\s)(sm:|md:|lg:)?min-h-/, value: 'min-h-10' },
]

// primary is the gold call to action, secondary the arcane violet, ghost a raised panel button.
const VARIANTS = {
  primary: 'kit-gold',
  secondary: 'kit-arcane',
  ghost: 'kit-raised',
}

export const buttonClasses = (variant = 'primary', className = '') => {
  const size = SIZE.filter(({ test }) => !test.test(className)).map(({ value }) => value)
  return [BASE, ...size, VARIANTS[variant], className].filter(Boolean).join(' ')
}

export default function PixelButton({ as: Component = 'button', variant = 'primary', className = '', ...props }) {
  const typeProps = Component === 'button' ? { type: 'button' } : {}
  return <Component {...typeProps} {...props} className={buttonClasses(variant, className)} />
}
