import { useId } from 'react'

// The gray of a skeleton block (the same --color-line the dashed rules use), breathing unless the
// reader asked for less motion.
const FILL = 'bg-line motion-safe:animate-skeleton'

// Stands in for a part of the page while its data loads. Screen readers hear `label` once (the
// page's old "Loading..." text); everything drawn inside is decoration. className lays the blocks
// out: pages pass the same container and grid classes the real content uses, so nothing jumps
// when it arrives.
export default function Skeleton({ label, className = '', children }) {
  const id = useId()
  return (
    <div role="status" aria-busy="true" aria-labelledby={id}>
      <span id={id} className="sr-only">
        {label}
      </span>
      <div aria-hidden="true" className={className}>
        {children}
      </div>
    </div>
  )
}

// A solid block: an avatar, a chip, a number, a button. Size comes from className.
export function Bone({ className = '', ...props }) {
  return <span aria-hidden="true" {...props} className={`block ${FILL} ${className}`} />
}

// A round block, for the rare round thing.
export function Circle({ className = 'size-8' }) {
  return <Bone className={`rounded-full ${className}`} />
}

// One line of text. className carries the real text's size and leading (text-sm, font-pixel
// text-2xl leading-tight, ...), so the line is exactly as tall as the text it stands in for;
// the bar inside is a bit shorter, like the letters are.
export function Line({ className = '', width = 'w-full' }) {
  return (
    <span aria-hidden="true" className={`flex items-center ${className}`}>
      <span className={`h-[0.7em] max-w-full ${width} ${FILL}`} />
      {/* A zero-width space gives the line the text's own line height. */}
      {'​'}
    </span>
  )
}

// A paragraph: `count` lines, the last one shorter.
export function Lines({ count = 2, className = '', last = 'w-2/3' }) {
  return (
    <span aria-hidden="true" className="block">
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative lines
        <Line key={index} className={className} width={index === count - 1 && count > 1 ? last : 'w-full'} />
      ))}
    </span>
  )
}

// A form field: its label (an inline label sits in a 24px line), then the 2px ink box of the
// input (48px, like the real one).
export function Field({ className = '', label = 'w-24', box = 'h-12' }) {
  return (
    <span aria-hidden="true" className={`block ${className}`}>
      <Line className="font-label text-xs leading-6" width={label} />
      <span className={`mt-2 block border-2 border-ink bg-white ${box}`} />
    </span>
  )
}
