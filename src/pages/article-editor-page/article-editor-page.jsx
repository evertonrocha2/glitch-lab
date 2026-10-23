import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { COMMUNITY_LIMITS, parseTags, tagProblem } from '../../../shared/community.js'
import ArticleBody from '../../components/community/article-body/article-body.jsx'
import CommunityShell from '../../components/layout/community-shell/community-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import { AuthError, createArticle, getArticle, listCases, updateArticle } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { splitError } from '../../lib/case-info.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../lib/i18n/labels.js'
import { useProgress } from '../../lib/progress/progress-provider.jsx'
import ArticleEditorPageSkeleton from './article-editor-page-skeleton.jsx'

const INPUT = 'w-full border-2 border-ink bg-white px-3 py-2.5 text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel'
const LABEL = 'font-label text-xs text-ink'
const EMPTY = { title: '', tags: '', body: '', caseId: '' }

// What's wrong with the typed tags, or null. tagProblem (shared with the API) says it in English,
// so the reason is told again here in the reader's language.
function tagsProblem(tags, t) {
  const bad = tags.find((tag) => tagProblem(tag))
  if (bad) return bad.length > COMMUNITY_LIMITS.tag ? t('notes.editorPage.tagTooLong', { max: COMMUNITY_LIMITS.tag }) : t('notes.editorPage.tagChars')
  return tags.length > COMMUNITY_LIMITS.tags ? t('notes.editorPage.tooManyTags', { max: COMMUNITY_LIMITS.tags }) : null
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
  const t = useT()
  const labels = useLabels()
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
  const problem = tagsProblem(tags, t)
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
        &lt; {id ? t('notes.editorPage.back') : t('notes.article.all')}
      </Link>
      <p className="mt-6 font-label text-xs text-secondary">
        &gt; {id ? t('notes.editorPage.promptEdit') : t('notes.editorPage.promptNew')}
        <span className="motion-safe:animate-caret">_</span>
      </p>
      <h1 className="mt-3 font-pixel text-3xl font-bold text-ink sm:text-4xl">{id ? t('notes.editorPage.titleEdit') : t('notes.articles.write')}</h1>
      <p className="mt-2 max-w-xl text-muted">{t('notes.editorPage.lede')}</p>

      {status === 'loading' && <ArticleEditorPageSkeleton />}
      {status === 'forbidden' && <p className="mt-8 border-2 border-dashed border-ink/40 p-6 text-muted">{t('notes.editorPage.forbidden')}</p>}
      {status === 'error' && (
        <div className="mt-8">
          <ErrorNotice message={message} />
        </div>
      )}

      {status === 'ready' && (
        <form onSubmit={save} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <PixelCard className="min-w-0 p-5 sm:p-7">
            {user?.isDemo && (
              <p className="mb-5 border-2 border-ink bg-secondary-soft p-3 text-sm text-ink">{t('notes.editorPage.demo')}</p>
            )}
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="article-title" className={LABEL}>
                {t('notes.editorPage.title')}
              </label>
              <Counter value={draft.title.length} max={COMMUNITY_LIMITS.title} />
            </div>
            <input
              id="article-title"
              value={draft.title}
              onChange={set('title')}
              maxLength={COMMUNITY_LIMITS.title}
              placeholder={t('notes.editorPage.titlePlaceholder')}
              className={`mt-2 font-pixel text-xl ${INPUT}`}
            />

            <label htmlFor="article-tags" className={`mt-6 block ${LABEL}`}>
              {t('notes.editorPage.tags')}
            </label>
            <input id="article-tags" value={draft.tags} onChange={set('tags')} placeholder={t('notes.editorPage.tagsPlaceholder')} className={`mt-2 font-mono text-sm ${INPUT}`} />
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
                  : t('notes.editorPage.tagsHint', { max: COMMUNITY_LIMITS.tags })}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
              <div role="tablist" aria-label={t('notes.editorPage.bodyView')} className="flex border-2 border-ink">
                {[
                  { id: 'write', label: t('notes.editorPage.write') },
                  { id: 'preview', label: t('notes.editorPage.preview') },
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
                  {t('notes.editorPage.body')}
                </label>
                <textarea
                  id="article-body"
                  value={draft.body}
                  onChange={set('body')}
                  maxLength={COMMUNITY_LIMITS.body}
                  rows={16}
                  placeholder={t('notes.editorPage.bodyPlaceholder')}
                  className={`mt-3 block resize-y font-mono text-sm leading-relaxed ${INPUT}`}
                />
                <p className="mt-1.5 text-xs text-muted">{t('notes.editorPage.bodyHint')}</p>
              </>
            ) : (
              <div role="tabpanel" aria-label={t('notes.editorPage.preview')} className="mt-3 min-h-64 border-2 border-dashed border-ink/40 p-4">
                <ArticleBody body={draft.body} />
              </div>
            )}
          </PixelCard>

          <div className="space-y-5">
            <PixelCard tone="secondary" className="p-5">
              <label htmlFor="article-case" className={LABEL}>
                {t('notes.editorPage.linkedCase')}
              </label>
              <select id="article-case" value={draft.caseId} onChange={set('caseId')} className={`mt-2 text-sm ${INPUT}`}>
                <option value="">{t('notes.editorPage.noCase')}</option>
                {cases.map((item) => (
                  <option key={item.id} value={item.id}>
                    {splitError(item.error).type} · {labels.concept(item.concept)} ({item.language})
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted">{t('notes.editorPage.caseHint')}</p>
            </PixelCard>

            {message && <ErrorNotice message={message} />}
            <PixelButton type="submit" disabled={!canSave} className="w-full py-3">
              {saving ? t('notes.editorPage.saving') : id ? t('notes.editorPage.save') : t('notes.editorPage.publish')}
            </PixelButton>
          </div>
        </form>
      )}
    </CommunityShell>
  )
}
