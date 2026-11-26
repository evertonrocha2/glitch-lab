import { useEffect, useRef } from 'react'
import { iconCanvas } from './sprite.js'

const BASE = 18

// size 1, 2 or 3 scales the 18px sprite by that factor.
export default function GameIcon({ name, size = 2, label, className = '' }) {
  const ref = useRef(null)
  const px = BASE * size

  useEffect(() => {
    const target = ref.current?.getContext('2d')
    const sprite = iconCanvas(name)
    if (!target || !sprite) return
    target.imageSmoothingEnabled = false
    target.clearRect(0, 0, px, px)
    target.drawImage(sprite, 0, 0, px, px)
  }, [name, px])

  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }
  return (
    <canvas
      ref={ref}
      width={px}
      height={px}
      className={`inline-block shrink-0 ${className}`}
      style={{ imageRendering: 'pixelated', width: px, height: px }}
      {...a11y}
    />
  )
}
