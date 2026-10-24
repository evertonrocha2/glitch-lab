// A small pixel icon for each kind of block in the "/" menu: a white tile with a 2px ink border,
// holding a pixel label or a crisp little drawing.
const LABELS = { text: 'T', heading1: 'H1', heading2: 'H2', heading3: 'H3', numbered: '1.', quote: '"', code: '</>', callout: '!', case: '@' }

function Drawing({ kind }) {
  const rects = {
    todo: [
      [0, 0, 7, 1],
      [0, 6, 7, 1],
      [0, 0, 1, 7],
      [6, 0, 1, 7],
      [2, 3, 1, 1],
      [3, 4, 1, 1],
      [4, 2, 1, 2],
    ],
    bullet: [
      [0, 1, 2, 2],
      [3, 1, 4, 1],
      [0, 4, 2, 2],
      [3, 5, 4, 1],
    ],
    divider: [
      [0, 3, 7, 1],
      [0, 2, 1, 3],
      [6, 2, 1, 3],
    ],
    emoji: [
      [1, 0, 5, 1],
      [0, 1, 1, 5],
      [6, 1, 1, 5],
      [1, 6, 5, 1],
      [2, 2, 1, 1],
      [4, 2, 1, 1],
      [2, 4, 3, 1],
    ],
  }[kind]
  return (
    <svg aria-hidden="true" viewBox="0 0 7 7" shapeRendering="crispEdges" className="size-3.5 fill-current">
      {rects.map(([x, y, width, height]) => (
        <rect key={`${x}-${y}-${width}`} x={x} y={y} width={width} height={height} />
      ))}
    </svg>
  )
}

export default function BlockIcon({ kind }) {
  return (
    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center border-2 border-ink bg-white font-label text-[10px] leading-none text-primary">
      {LABELS[kind] ?? <Drawing kind={kind} />}
    </span>
  )
}
