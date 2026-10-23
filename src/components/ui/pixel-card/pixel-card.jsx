const TONES = {
  primary: 'shadow-pixel',
  secondary: 'shadow-pixel-secondary',
  muted: 'shadow-pixel-muted',
}

export default function PixelCard({ as: Component = 'div', tone = 'primary', className = '', children, ...props }) {
  return (
    <Component {...props} className={`border-2 border-ink bg-white ${TONES[tone]} ${className}`}>
      {children}
    </Component>
  )
}
