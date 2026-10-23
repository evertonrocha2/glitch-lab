import PixelLogo from '../../ui/pixel-logo/pixel-logo.jsx'

// The assistant's face: the magnifying glass from the logo in a small pixel frame.
export default function DetectiveAvatar({ className = 'size-8' }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center border-2 border-ink bg-primary-soft ${className}`}>
      <PixelLogo className="size-5" />
    </span>
  )
}
