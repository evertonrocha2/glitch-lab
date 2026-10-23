// Errors stay in the palette (no red): an ink frame, a purple "!" and the message itself.
export default function ErrorNotice({ message }) {
  return (
    <div role="alert" className="flex items-start gap-3 border-2 border-ink bg-primary-soft p-4 text-ink shadow-pixel">
      <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center bg-primary font-label text-xs text-white">
        !
      </span>
      <p>{message}</p>
    </div>
  )
}
