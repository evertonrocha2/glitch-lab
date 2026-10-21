import { conceptLabel } from '../../../shared/concepts.js'

export const firstLine = (text) => text.split('\n')[0]

export default function CaseCard({ item, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="w-full border-2 border-ink bg-white p-3 text-left shadow-pixel-muted transition-[translate,box-shadow] duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-pixel"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-label text-[10px] text-primary">{conceptLabel(item.concept)}</span>
        <span className="font-label text-[10px] text-muted">{item.language}</span>
      </span>
      <span className="mt-2 line-clamp-2 block break-words font-mono text-[12.5px] leading-snug text-ink">{firstLine(item.error)}</span>
      {item.status === 'training' && (
        <span className="mt-2 block font-label text-[10px] text-secondary">{item.passedCount} of 2 passed</span>
      )}
    </button>
  )
}
