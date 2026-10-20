const BASE =
  'inline-flex items-center justify-center gap-2 border-2 border-ink px-4 py-2.5 font-label text-xs tracking-wide transition-[translate,box-shadow] duration-100 active:translate-x-[2px] active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-50 disabled:translate-0 disabled:shadow-none'

// Colored buttons sit on a hard ink shadow that shrinks when pressed.
const VARIANTS = {
  primary: 'bg-primary text-white shadow-pixel-ink active:shadow-[2px_2px_0_var(--color-ink)]',
  secondary: 'bg-secondary text-white shadow-pixel-ink active:shadow-[2px_2px_0_var(--color-ink)]',
  ghost: 'bg-white text-ink hover:bg-mist',
}

export default function PixelButton({ as: Component = 'button', variant = 'primary', className = '', ...props }) {
  const typeProps = Component === 'button' ? { type: 'button' } : {}
  return <Component {...typeProps} {...props} className={`${BASE} ${VARIANTS[variant]} ${className}`} />
}
