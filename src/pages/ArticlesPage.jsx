import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { cleanQuery, SORT_IDS, SORTS } from '../../shared/community.js'
import ArticleList from '../components/community/ArticleList.jsx'
import CommunityShell from '../components/community/CommunityShell.jsx'
import PixelButton from '../components/pixel/PixelButton.jsx'
import { useAuth } from '../lib/auth/AuthProvider.jsx'

const MAX_CHIPS = 10

// The community: everyone's articles, searchable. Filters live in the address, so a search can be shared.
export default function ArticlesPage() {
  const { user } = useAuth()
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
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <p className="font-label text-xs text-secondary">
            &gt; community<span className="motion-safe:animate-caret">_</span>
          </p>
          <h1 className="mt-3 font-pixel text-3xl font-bold text-ink sm:text-4xl">Articles</h1>
          <p className="mt-2 max-w-xl text-muted">Short write-ups from students who cracked a bug. Read them, rate them valid or bad, and share what you learned.</p>
        </div>
        {user ? (
          <PixelButton as={Link} to="/articles/new" className="px-5 py-3">
            Write an article
          </PixelButton>
        ) : (
          <PixelButton as={Link} to={`/login?next=${encodeURIComponent('/articles/new')}`} className="px-5 py-3">
            Sign in to write
          </PixelButton>
        )}
      </div>

      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          setFilter({ q: cleanQuery(typed) })
        }}
        className="mt-8 flex gap-2"
      >
        <label htmlFor="article-search" className="sr-only">
          Search articles
        </label>
        <input
          id="article-search"
          type="search"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder="Search titles, tags, authors"
          maxLength={80}
          className="min-w-0 flex-1 border-2 border-ink bg-white px-3 py-2.5 text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel"
        />
        <PixelButton type="submit" variant="secondary" className="px-4">
          Search
        </PixelButton>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label="Sort" className="flex border-2 border-ink bg-white">
          {SORTS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={sort === option.id}
              onClick={() => setFilter({ sort: option.id })}
              className={`px-3 py-2 font-label text-[11px] transition-colors sm:text-xs ${sort === option.id ? 'bg-primary text-white' : 'text-ink hover:bg-mist'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
          {tag && (
            <li>
              <button
                type="button"
                onClick={() => setFilter({ tag: '' })}
                aria-label={`Clear tag ${tag}`}
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
                aria-label={`Filter by #${value}`}
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
