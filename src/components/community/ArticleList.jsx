import { useEffect, useRef, useState } from 'react'
import { listArticles } from '../../lib/api.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import ErrorNotice from '../ErrorNotice.jsx'
import PixelButton from '../pixel/PixelButton.jsx'
import ArticleCard from './ArticleCard.jsx'

// Community articles matching the filters, a page at a time. Works signed out.
// author: only that handle's articles (for a profile page). onTag: makes tags clickable filters.
// onArticles: hears every article loaded so far (the list page builds its tag chips from them).
export default function ArticleList({ q = '', tag = '', author = '', sort = 'new', onTag, onArticles, emptyMessage }) {
  const t = useT()
  const [state, setState] = useState({ status: 'loading', articles: [], page: 1, hasMore: false })
  const [loadingMore, setLoadingMore] = useState(false)
  const latest = useRef(0)

  useEffect(() => {
    const call = ++latest.current
    setState({ status: 'loading', articles: [], page: 1, hasMore: false })
    listArticles({ q, tag, author, sort, page: 1 })
      .then(({ articles, hasMore }) => call === latest.current && setState({ status: 'ready', articles, page: 1, hasMore }))
      .catch((err) => call === latest.current && setState({ status: 'error', articles: [], page: 1, hasMore: false, message: err.message }))
  }, [q, tag, author, sort])

  useEffect(() => {
    onArticles?.(state.articles)
  }, [state.articles, onArticles])

  async function loadMore() {
    const call = latest.current
    setLoadingMore(true)
    try {
      const next = await listArticles({ q, tag, author, sort, page: state.page + 1 })
      if (call !== latest.current) return
      setState((current) => ({
        ...current,
        // A new article can push one onto the next page twice; keep the first copy.
        articles: [...current.articles, ...next.articles.filter((item) => !current.articles.some((seen) => seen.id === item.id))],
        page: current.page + 1,
        hasMore: next.hasMore,
      }))
    } catch (err) {
      if (call === latest.current) setState((current) => ({ ...current, message: err.message }))
    } finally {
      setLoadingMore(false)
    }
  }

  if (state.status === 'loading') {
    return (
      <p role="status" className="font-label text-xs text-muted">
        {t('notes.articles.loading')}
      </p>
    )
  }
  if (state.status === 'error') return <ErrorNotice message={state.message} />

  const filtered = Boolean(q || tag)
  return (
    <div>
      {state.articles.length === 0 ? (
        <div className="relative grid min-h-40 place-items-center overflow-hidden border-2 border-dashed border-ink/40 p-8 text-center">
          <div aria-hidden="true" className="dither-secondary absolute inset-0 opacity-15" />
          <p className="relative max-w-sm text-muted">
            {emptyMessage ?? (filtered ? t('notes.articles.noMatch') : t('notes.articles.none'))}
          </p>
        </div>
      ) : (
        <ul aria-label={t('notes.articles.list')} className="grid gap-5 md:grid-cols-2">
          {state.articles.map((article) => (
            <li key={article.id} className="flex">
              <ArticleCard article={article} onTag={onTag} />
            </li>
          ))}
        </ul>
      )}
      {state.message && (
        <div className="mt-5">
          <ErrorNotice message={state.message} />
        </div>
      )}
      {state.hasMore && (
        <div className="mt-8 text-center">
          <PixelButton variant="ghost" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? t('notes.articles.loadingMore') : t('notes.articles.loadMore')}
          </PixelButton>
        </div>
      )}
    </div>
  )
}
