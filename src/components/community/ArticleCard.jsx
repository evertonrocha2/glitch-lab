import { Link } from 'react-router'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useFormat } from '../../lib/i18n/format.js'
import AuthorChip from './AuthorChip.jsx'
import CommunityIcon from './CommunityIcon.jsx'

// "3 likes, 2 valid, 0 bad, 1 comment" for screen readers; little pixel icons for everyone else.
export function CountRow({ counts }) {
  const t = useT()
  const items = [
    { icon: 'heart', value: counts.likes, tone: 'text-primary' },
    { icon: 'check', value: counts.valid, tone: 'text-secondary' },
    { icon: 'cross', value: counts.bad, tone: 'text-muted' },
    { icon: 'comment', value: counts.comments, tone: 'text-ink' },
  ]
  return (
    <span className="flex items-center gap-3 text-xs text-ink">
      <span className="sr-only">
        {[
          t('notes.articles.likes', { count: counts.likes }),
          t('notes.articles.valids', { count: counts.valid }),
          t('notes.articles.bads', { count: counts.bad }),
          t('notes.articles.comments', { count: counts.comments }),
        ].join(', ')}
      </span>
      {items.map((item) => (
        <span key={item.icon} aria-hidden="true" className="flex items-center gap-1 font-label text-xs">
          <CommunityIcon name={item.icon} className={`size-3 ${item.tone}`} />
          {item.value}
        </span>
      ))}
    </span>
  )
}

// One article in a list. onTag, when given, turns the tags into filter buttons.
export default function ArticleCard({ article, onTag }) {
  const t = useT()
  const { since } = useFormat()
  return (
    <article className="flex w-full min-w-0 flex-col border-2 border-ink bg-white p-4 shadow-pixel-muted transition-[translate,box-shadow] duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-pixel sm:p-5">
      {article.tags.length > 0 && (
        <ul aria-label={t('notes.articles.tags')} className="mb-3 flex flex-wrap gap-1.5">
          {article.tags.map((tag) => (
            <li key={tag}>
              {onTag ? (
                <button
                  type="button"
                  onClick={() => onTag(tag)}
                  aria-label={t('notes.articles.filterTag', { tag })}
                  className="bg-primary-soft px-1.5 py-0.5 font-mono text-xs text-primary hover:bg-primary hover:text-white"
                >
                  #{tag}
                </button>
              ) : (
                <span className="bg-primary-soft px-1.5 py-0.5 font-mono text-xs text-primary">#{tag}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <h2 className="break-words font-pixel text-xl font-bold leading-tight text-ink sm:text-2xl">
        <Link to={`/articles/${article.id}`} className="hover:text-primary hover:underline">
          {article.title}
        </Link>
      </h2>
      {article.excerpt && <p className="mt-2 line-clamp-3 break-words text-sm text-ink/80">{article.excerpt}</p>}
      <span aria-hidden="true" className="min-h-4 flex-1" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-line pt-3">
        <AuthorChip author={article.author} meta={since(article.createdAt)} size="size-7" />
        <CountRow counts={article.counts} />
      </div>
    </article>
  )
}
