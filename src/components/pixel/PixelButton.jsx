const BASE =
  'items-center justify-center gap-2 border-2 border-ink font-label tracking-wide transition-[translate,box-shadow] duration-100 active:translate-x-[2px] active:translate-y-[2px] disabled:cursor-not-allowed disabled:translate-0 disabled:border-ink/30 disabled:bg-mist disabled:text-muted disabled:shadow-none'

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

// Colored buttons sit on a hard ink shadow that shrinks when pressed.
const VARIANTS = {
  primary: 'bg-primary text-white shadow-pixel-ink active:shadow-[2px_2px_0_var(--color-ink)]',
  secondary: 'bg-secondary text-white shadow-pixel-ink active:shadow-[2px_2px_0_var(--color-ink)]',
  ghost: 'bg-white text-ink hover:bg-mist',
}

export const buttonClasses = (variant = 'primary', className = '') => {
  const size = SIZE.filter(({ test }) => !test.test(className)).map(({ value }) => value)
  return [BASE, ...size, VARIANTS[variant], className].filter(Boolean).join(' ')
}

export default function PixelButton({ as: Component = 'button', variant = 'primary', className = '', ...props }) {
  const typeProps = Component === 'button' ? { type: 'button' } : {}
  return <Component {...typeProps} {...props} className={buttonClasses(variant, className)} />
}
