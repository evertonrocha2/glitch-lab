import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { COMMUNITY_LIMITS, parseTags, tagProblem } from '../../shared/community.js'
import { conceptLabel } from '../../shared/concepts.js'
import ArticleBody from '../components/community/ArticleBody.jsx'
import CommunityShell from '../components/community/CommunityShell.jsx'
import ErrorNotice from '../components/ErrorNotice.jsx'
import PixelButton from '../components/pixel/PixelButton.jsx'
import PixelCard from '../components/pixel/PixelCard.jsx'
import { AuthError, createArticle, getArticle, listCases, updateArticle } from '../lib/api.js'
import { useAuth } from '../lib/auth/AuthProvider.jsx'
import { splitError } from '../lib/caseInfo.js'
import { useProgress } from '../lib/progress/ProgressProvider.jsx'

const INPUT = 'w-full border-2 border-ink bg-white px-3 py-2.5 text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel'
const LABEL = 'font-label text-xs text-ink'
const EMPTY = { title: '', tags: '', body: '', caseId: '' }
const BODY_HINT = 'Leave a blank line between paragraphs. Wrap code in `backticks`, or put a block between ``` lines.'

// What's wrong with the typed tags, or null.
function tagsProblem(tags) {
  const bad = tags.map(tagProblem).find(Boolean)
  if (bad) return bad
  return tags.length > COMMUNITY_LIMITS.tags ? `Use up to ${COMMUNITY_LIMITS.tags} tags.` : null
}

function Counter({ value, max }) {
  return (
    <span className={`font-label text-[10px] ${value > max ? 'text-primary' : 'text-muted'}`}>
      {value}/{max}
    </span>
  )
}

// Write a new article (/articles/new) or edit one of yours (/articles/:id/edit).
export default function ArticleEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, getToken, signOut } = useAuth()
  const { refresh: refreshProgress } = useProgress()
  const [draft, setDraft] = useState(EMPTY)
  const [cases, setCases] = useState([])
  const [tab, setTab] = useState('write')
  const [status, setStatus] = useState(id ? 'loading' : 'ready')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const token = await getToken()
        const [caseList, loaded] = await Promise.all([listCases(token), id ? getArticle(id, token) : null])
        if (!live) return
        setCases(caseList)
        if (!loaded) return
        if (!loaded.article.mine) {
          setStatus('forbidden')
          return
        }
        const { title, tags, body, caseId } = loaded.article
        setDraft({ title, tags: tags.join(', '), body, caseId: caseId ?? '' })
        setStatus('ready')
      } catch (err) {
        if (!live) return
        if (err instanceof AuthError) await signOut()
        else if (id) {
          setStatus('error')
          setMessage(err.message)
        }
        // A new article still works without the case list.
      }
    })()
    return () => {
      live = false
    }
  }, [id, getToken, signOut])

  const set = (field) => (event) => setDraft((current) => ({ ...current, [field]: event.target.value }))
  const tags = parseTags(draft.tags)
  const problem = tagsProblem(tags)
  const title = draft.title.trim()
  const body = draft.body.trim()
  const tooLong = title.length > COMMUNITY_LIMITS.title || body.length > COMMUNITY_LIMITS.body
  const canSave = Boolean(title && body && !problem && !tooLong && !saving && !user?.isDemo)

  async function save(event) {
    event.preventDefault()
    if (!canSave) return
    setSaving(true)
    setMessage('')
    const fields = { title, tags, body, caseId: draft.caseId || null }
    try {
      const token = await getToken()
      const saved = id ? await updateArticle(id, fields, token) : await createArticle(fields, token)
      refreshProgress()
      navigate(`/articles/${saved.id}`)
    } catch (err) {
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
      setSaving(false)
    }
  }

  return (
    <CommunityShell>
      <Link to={id ? `/articles/${id}` : '/articles'} className="font-label text-xs text-ink hover:text-primary">
        &lt; {id ? 'Back to the article' : 'All articles'}
      </Link>
      <p className="mt-6 font-label text-xs text-secondary">
        &gt; {id ? 'edit article' : 'new article'}
        <span className="motion-safe:animate-caret">_</span>
      </p>
      <h1 className="mt-3 font-pixel text-3xl font-bold text-ink sm:text-4xl">{id ? 'Edit your article' : 'Write an article'}</h1>
      <p className="mt-2 max-w-xl text-muted">Explain one bug you understand now. Others can like it, rate it valid or bad, and comment. Publishing earns XP.</p>

      {status === 'loading' && (
        <p role="status" className="mt-8 font-label text-xs text-muted">
          Loading your article...
        </p>
      )}
      {status === 'forbidden' && <p className="mt-8 border-2 border-dashed border-ink/40 p-6 text-muted">You can only edit your own articles.</p>}
      {status === 'error' && (
        <div className="mt-8">
          <ErrorNotice message={message} />
        </div>
      )}

      {status === 'ready' && (
        <form onSubmit={save} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <PixelCard className="min-w-0 p-5 sm:p-7">
            {user?.isDemo && (
              <p className="mb-5 border-2 border-ink bg-secondary-soft p-3 text-sm text-ink">Sign up to publish articles. Demo accounts can read, like and rate.</p>
            )}
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="article-title" className={LABEL}>
                Title
              </label>
              <Counter value={draft.title.length} max={COMMUNITY_LIMITS.title} />
            </div>
            <input
              id="article-title"
              value={draft.title}
              onChange={set('title')}
              maxLength={COMMUNITY_LIMITS.title}
              placeholder="Undefined everywhere: reading a property too early"
              className={`mt-2 font-pixel text-xl ${INPUT}`}
            />

            <label htmlFor="article-tags" className={`mt-6 block ${LABEL}`}>
              Tags
            </label>
            <input id="article-tags" value={draft.tags} onChange={set('tags')} placeholder="javascript, loops" className={`mt-2 font-mono text-sm ${INPUT}`} />
            {problem ? (
              <p className="mt-1.5 text-xs text-primary">{problem}</p>
            ) : (
              <p className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-muted">
                {tags.length
                  ? tags.map((tag) => (
                      <span key={tag} className="bg-primary-soft px-1.5 py-0.5 font-mono text-primary">
                        #{tag}
                      </span>
                    ))
                  : `Up to ${COMMUNITY_LIMITS.tags} words, separated by commas.`}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
              <div role="tablist" aria-label="Body view" className="flex border-2 border-ink">
                {[
                  { id: 'write', label: 'Write' },
                  { id: 'preview', label: 'Preview' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === option.id}
                    onClick={() => setTab(option.id)}
                    className={`px-3 py-1.5 font-label text-xs ${tab === option.id ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-mist'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <Counter value={draft.body.length} max={COMMUNITY_LIMITS.body} />
            </div>
            {tab === 'write' ? (
              <>
                <label htmlFor="article-body" className="sr-only">
                  Article
                </label>
                <textarea
                  id="article-body"
                  value={draft.body}
                  onChange={set('body')}
                  maxLength={COMMUNITY_LIMITS.body}
                  rows={16}
                  placeholder="What was the bug, why did it happen, and how do you spot it next time?"
                  className={`mt-3 block resize-y font-mono text-sm leading-relaxed ${INPUT}`}
                />
                <p className="mt-1.5 text-xs text-muted">{BODY_HINT}</p>
              </>
            ) : (
              <div role="tabpanel" aria-label="Preview" className="mt-3 min-h-64 border-2 border-dashed border-ink/40 p-4">
                <ArticleBody body={draft.body} />
              </div>
            )}
          </PixelCard>

          <div className="space-y-5">
            <PixelCard tone="secondary" className="p-5">
              <label htmlFor="article-case" className={LABEL}>
                Linked case (optional)
              </label>
              <select id="article-case" value={draft.caseId} onChange={set('caseId')} className={`mt-2 text-sm ${INPUT}`}>
                <option value="">No case</option>
                {cases.map((item) => (
                  <option key={item.id} value={item.id}>
                    {splitError(item.error).type} · {conceptLabel(item.concept)} ({item.language})
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted">Readers see only its error type, bug type and language. Your code stays private.</p>
            </PixelCard>

            {message && <ErrorNotice message={message} />}
            <PixelButton type="submit" disabled={!canSave} className="w-full py-3">
              {saving ? 'Saving...' : id ? 'Save changes' : 'Publish'}
            </PixelButton>
          </div>
        </form>
      )}
    </CommunityShell>
  )
}
