import { CALLOUT_EMOJI, headingLevel, isList } from '../../../../shared/note-blocks.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import InlineText from '../inline-text/inline-text.jsx'

// Soft boxes in the Pixel Lab colors; the warning one is a pale yellow, never a loud one.
export const CALLOUT_TONE = {
  info: 'border-secondary bg-secondary-soft',
  tip: 'border-primary bg-primary-soft',
  warning: 'border-ink bg-[#fff6d6]',
}

// Consecutive to-dos share one list, consecutive list items one <ul>/<ol> (indented ones nested
// under the item before), and empty text lines are skipped.
export function groupBlocks(blocks) {
  const groups = []
  for (const block of blocks) {
    if (block.type === 'text' && block.text.trim() === '') continue
    const last = groups.at(-1)
    if (block.type === 'todo') {
      if (last?.type === 'todos') last.items.push(block)
      else groups.push({ type: 'todos', id: block.id, items: [block] })
      continue
    }
    if (isList(block)) {
      const nested = block.indent === 1 && last?.type === 'list'
      if (nested) {
        last.items.at(-1).children.push(block)
      } else if (last?.type === 'list' && last.ordered === (block.type === 'numbered')) {
        last.items.push({ block, children: [] })
      } else {
        groups.push({ type: 'list', id: block.id, ordered: block.type === 'numbered', items: [{ block, children: [] }] })
      }
      continue
    }
    groups.push(block)
  }
  return groups
}

const HEADING = {
  sheet: ['pt-5 text-[26px]', 'pt-4 text-[22px]', 'pt-3 text-lg'],
  page: ['pt-4 text-2xl sm:text-[26px]', 'pt-3 text-xl sm:text-[22px]', 'pt-2 text-lg'],
}

function List({ ordered, items, nested = false }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={`space-y-1 pl-6 leading-relaxed text-ink ${ordered ? 'list-decimal' : 'list-[square]'} ${nested ? 'mt-1' : 'py-1'}`}>
      {items.map(({ block, children }) => (
        <li key={block.id} className="wrap-break-word marker:text-primary">
          <InlineText text={block.text} />
          {children.length > 0 && <List ordered={children[0].type === 'numbered'} items={children.map((child) => ({ block: child, children: [] }))} nested />}
        </li>
      ))}
    </Tag>
  )
}

// A code block on white with a gray bar: light enough to print, the language named on top.
export function CodeView({ block, wrap = false }) {
  const t = useT()
  return (
    <figure className="border-2 border-ink bg-white shadow-pixel-muted">
      <figcaption className="border-b-2 border-ink bg-mist px-3 py-1 font-label text-[10px] text-muted">{block.language || t('notes.code.plain')}</figcaption>
      <pre className={`px-4 py-3 font-mono text-sm leading-relaxed text-ink ${wrap ? 'whitespace-pre-wrap wrap-break-word' : 'overflow-x-auto'}`}>
        <code>{block.text}</code>
      </pre>
    </figure>
  )
}

// A read-only note body. variant: 'sheet' (the exported picture) or 'page' (the public page).
// renderTodos and renderCase draw the blocks each place shows its own way.
export default function RichBlocks({ blocks, variant = 'page', renderTodos, renderCase }) {
  const t = useT()
  return groupBlocks(blocks).map((block) => {
    switch (block.type) {
      case 'heading': {
        const level = headingLevel(block)
        const Tag = `h${level + 1}`
        return (
          <Tag key={block.id} className={`font-pixel leading-tight font-bold wrap-break-word text-ink ${HEADING[variant][level - 1]}`}>
            <InlineText text={block.text} />
          </Tag>
        )
      }
      case 'todos':
        return <div key={block.id}>{renderTodos(block.items)}</div>
      case 'list':
        return (
          <div key={block.id} data-sheet-block>
            <List ordered={block.ordered} items={block.items} />
          </div>
        )
      case 'case':
        return (
          <div key={block.id} data-sheet-block className="py-1.5 pr-1">
            {renderCase(block)}
          </div>
        )
      case 'quote':
        return (
          <blockquote key={block.id} data-sheet-block className="border-l-4 border-primary bg-primary-soft/40 py-1 pl-4 leading-relaxed wrap-break-word whitespace-pre-wrap text-ink/85 italic">
            <InlineText text={block.text} />
          </blockquote>
        )
      case 'code':
        return (
          <div key={block.id} data-sheet-block className="py-1 pr-1">
            <CodeView block={block} wrap={variant === 'sheet'} />
          </div>
        )
      case 'divider':
        return <hr key={block.id} data-sheet-block className="my-3 border-0 border-t-2 border-dashed border-ink/50" />
      case 'callout':
        return (
          <aside
            key={block.id}
            data-sheet-block
            aria-label={t(`notes.callout.${block.tone}`)}
            className={`flex gap-3 border-2 px-4 py-3 ${CALLOUT_TONE[block.tone] ?? CALLOUT_TONE.info}`}
          >
            <span aria-hidden="true" className="text-xl leading-none">
              {block.emoji || CALLOUT_EMOJI[block.tone]}
            </span>
            <p className="min-w-0 flex-1 leading-relaxed wrap-break-word whitespace-pre-wrap text-ink">
              <InlineText text={block.text} />
            </p>
          </aside>
        )
      default:
        return (
          <p key={block.id} data-sheet-block className="leading-relaxed wrap-break-word whitespace-pre-wrap text-ink">
            <InlineText text={block.text} />
          </p>
        )
    }
  })
}
