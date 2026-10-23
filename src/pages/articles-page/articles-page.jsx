import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { cleanQuery, SORT_IDS } from '../../../shared/community.js'
import ArticleList from '../../components/community/article-list/article-list.jsx'
import CommunityShell from '../../components/layout/community-shell/community-shell.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import { useAuth } from '../../lib/auth/AuthProvider.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

const MAX_CHIPS = 10

// The community: everyone's articles, searchable. Filters live in the address, so a search can be shared.
export default function ArticlesPage() {
  const { user } = useAuth()
  const t = useT()
  const [params, setParams] = useSearchParams()
  const q = cleanQuery(params.get('q') ?? '')
  const tag = params.get('tag') ?? ''
  const sort = SORT_IDS.includes(params.get('sort')) ? params.get('sort') : 'new'
  const [typed, setTyped] = useState(q)
  const [loaded, setLoaded] = useState([])

  useEffect(() => setTyped(q), [q])

  // Changes one filter, dropping the ones that are back to their default.
  const setFilter = useCallback(
    (changes) => {
      setParams((current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (!value || (key === 'sort' && value === 'new')) next.delete(key)
          else next.set(key, value)
        }
        return next
      })
    },
    [setParams],
  )

  const pickTag = useCallback((value) => setFilter({ tag: value }), [setFilter])
  // Tags from what's on screen, so every chip finds something.
  const chips = [...new Set(loaded.flatMap((article) => article.tags))].filter((value) => value !== tag).slice(0, MAX_CHIPS)

  return (
    <CommunityShell>
      <PageHeader
        kicker={t('notes.articles.prompt')}
        title={t('notes.articles.title')}
        lead={t('notes.articles.lede')}
        actions={
          user ? (
            <PixelButton as={Link} to="/articles/new" className="px-5 py-3">
              {t('notes.articles.write')}
            </PixelButton>
          ) : (
            <PixelButton as={Link} to={`/login?next=${encodeURIComponent('/articles/new')}`} className="px-5 py-3">
              {t('notes.articles.signInToWrite')}
            </PixelButton>
          )
        }
      />

      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          setFilter({ q: cleanQuery(typed) })
        }}
        className="mt-8 flex gap-2"
      >
        <label htmlFor="article-search" className="sr-only">
          {t('notes.articles.searchLabel')}
        </label>
        <input
          id="article-search"
          type="search"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={t('notes.articles.searchPlaceholder')}
          maxLength={80}
          className="min-w-0 flex-1 border-2 border-ink bg-white px-3 py-2.5 text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel"
        />
        <PixelButton type="submit" variant="secondary" className="px-4">
          {t('notes.articles.search')}
        </PixelButton>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label={t('notes.articles.sort')} className="flex border-2 border-ink bg-white">
          {SORT_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={sort === id}
              onClick={() => setFilter({ sort: id })}
              className={`min-h-10 px-3 py-2 font-label text-xs transition-colors sm:text-xs ${sort === id ? 'bg-primary text-white' : 'text-ink hover:bg-mist'}`}
            >
              {t(`notes.articles.sort.${id}`)}
            </button>
          ))}
        </div>
        <ul aria-label={t('notes.articles.tags')} className="flex flex-wrap gap-1.5">
          {tag && (
            <li>
              <button
                type="button"
                onClick={() => setFilter({ tag: '' })}
                aria-label={t('notes.articles.clearTag', { tag })}
                className="border-2 border-ink bg-primary px-2 py-0.5 font-mono text-xs text-white"
              >
                #{tag} <span aria-hidden="true">x</span>
              </button>
            </li>
          )}
          {chips.map((value) => (
            <li key={value}>
              <button
                type="button"
                onClick={() => pickTag(value)}
                aria-label={t('notes.articles.filterTag', { tag: value })}
                className="border-2 border-transparent bg-primary-soft px-2 py-0.5 font-mono text-xs text-primary hover:border-ink"
              >
                #{value}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <ArticleList q={q} tag={tag} sort={sort} onTag={pickTag} onArticles={setLoaded} />
      </div>
    </CommunityShell>
  )
}
