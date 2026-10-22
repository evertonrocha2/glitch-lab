import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { COMMUNITY_LIMITS } from '../../shared/community.js'
import ArticleBody from '../components/community/ArticleBody.jsx'
import AuthorChip from '../components/community/AuthorChip.jsx'
import CommunityIcon from '../components/community/CommunityIcon.jsx'
import CommunityShell from '../components/community/CommunityShell.jsx'
import ErrorNotice from '../components/ErrorNotice.jsx'
import PixelButton from '../components/pixel/PixelButton.jsx'
import PixelCard from '../components/pixel/PixelCard.jsx'
import { addArticleComment, AuthError, deleteArticle, deleteArticleComment, getArticle, reactToArticle } from '../lib/api.js'
import { useAuth } from '../lib/auth/AuthProvider.jsx'
import { timeAgo } from '../lib/caseInfo.js'
import { useProgress } from '../lib/progress/ProgressProvider.jsx'

const SESSION_ENDED = 'Your session ended. Sign in again to keep going.'
const NO_REACTION = { liked: false, rating: null }
const EDIT_GRACE_MS = 60_000

const longDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function dateLine(article) {
  const edited = Date.parse(article.updatedAt) - Date.parse(article.createdAt) > EDIT_GRACE_MS
  return `${longDate(article.createdAt)}${edited ? ' · edited' : ''}`
}

// Only the kind of bug: the case's code and error text stay private.
function LinkedCase({ summary }) {
  return (
    <section aria-label="Linked case" className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-2 border-ink bg-secondary-soft px-4 py-3">
      <span className="font-label text-[10px] text-secondary">Linked case</span>
      <span className="font-pixel text-lg font-bold leading-none text-ink">{summary.errorType}</span>
      <span className="bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary">{summary.concept}</span>
      <span className="border border-ink/20 bg-white px-1.5 py-0.5 font-mono text-xs text-muted">{summary.language}</span>
    </section>
  )
}

function ReactionButton({ icon, label, count, pressed, disabled, onClick, tone }) {
  return (
    <button
      type="button"
      aria-label={`${label} (${count})`}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-2 border-2 border-ink px-3 py-2 font-label text-xs transition-[translate,box-shadow] duration-100 active:translate-x-[2px] active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-60 ${
        pressed ? `${tone} text-white shadow-pixel-ink` : 'bg-white text-ink hover:bg-mist'
      }`}
    >
      <CommunityIcon name={icon} className="size-3.5" />
      <span>{label}</span>
      <span className={`border-l-2 pl-2 ${pressed ? 'border-white/50' : 'border-line'}`}>{count}</span>
    </button>
  )
}

function Reactions({ article, reaction, busy, onReact }) {
  const { counts, mine } = article
  return (
    <section aria-label="Reactions" className="mt-10 border-t-2 border-dashed border-line pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <ReactionButton icon="heart" label="Like" count={counts.likes} pressed={reaction.liked} disabled={mine || busy} tone="bg-primary" onClick={() => onReact({ like: !reaction.liked })} />
        <span aria-hidden="true" className="mx-1 hidden h-6 w-0.5 bg-line sm:block" />
        <ReactionButton
          icon="check"
          label="Valid"
          count={counts.valid}
          pressed={reaction.rating === 'valid'}
          disabled={mine || busy}
          tone="bg-secondary"
          onClick={() => onReact({ rating: reaction.rating === 'valid' ? null : 'valid' })}
        />
        <ReactionButton
          icon="cross"
          label="Bad"
          count={counts.bad}
          pressed={reaction.rating === 'bad'}
          disabled={mine || busy}
          tone="bg-ink"
          onClick={() => onReact({ rating: reaction.rating === 'bad' ? null : 'bad' })}
        />
      </div>
      <p className="mt-3 text-xs text-muted">
        {mine ? "You can't like or rate your own article." : 'Is this explanation right? Rate it valid or bad. Press again to take it back.'}
      </p>
    </section>
  )
}

function Composer({ user, loginLink, onPost }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  if (!user) {
    return (
      <PixelButton as={Link} to={loginLink} variant="ghost">
        Sign in to comment
      </PixelButton>
    )
  }
  if (user.isDemo) return <p className="border-2 border-dashed border-ink/40 p-4 text-sm text-muted">Sign up to comment on articles. Demo accounts can still like and rate.</p>

  async function submit(event) {
    event.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    if (await onPost(text.trim())) setText('')
    setBusy(false)
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="comment-body" className="font-label text-xs text-ink">
        Your comment
      </label>
      <textarea
        id="comment-body"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={COMMUNITY_LIMITS.comment}
        rows={3}
        placeholder="Add what helped you, or ask a question."
        className="mt-2 block w-full resize-y border-2 border-ink bg-white px-3 py-2.5 text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="font-label text-[10px] text-muted">
          {text.length}/{COMMUNITY_LIMITS.comment}
        </span>
        <PixelButton type="submit" disabled={!text.trim() || busy}>
          {busy ? 'Posting...' : 'Post comment'}
        </PixelButton>
      </div>
    </form>
  )
}

function DeleteArticle({ onDelete }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <PixelButton variant="ghost" onClick={() => setAsking(true)} className="px-3 py-2">
        Delete
      </PixelButton>
    )
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink">Delete this article?</span>
      <PixelButton onClick={onDelete} className="px-3 py-2">
        Yes, delete it
      </PixelButton>
      <PixelButton variant="ghost" onClick={() => setAsking(false)} className="px-3 py-2">
        Cancel
      </PixelButton>
    </span>
  )
}

// One article: anyone can read it; signed-in readers can like, rate and comment.
export default function ArticlePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, getToken, signOut } = useAuth()
  const { refresh: refreshProgress } = useProgress()
  const [state, setState] = useState({ status: 'loading' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const loginLink = `/login?next=${encodeURIComponent(location.pathname)}`
  const userId = user?.id

  useEffect(() => {
    let live = true
    setState({ status: 'loading' })
    ;(async () => {
      try {
        const data = await getArticle(id, userId ? await getToken() : null)
        if (live) setState({ status: 'ready', ...data, reaction: data.reaction ?? NO_REACTION })
      } catch (err) {
        if (live) setState({ status: 'error', message: err.message })
      }
    })()
    return () => {
      live = false
    }
  }, [id, userId, getToken])

  const handleError = useCallback(
    async (err) => {
      if (err instanceof AuthError) {
        await signOut()
        setMessage(SESSION_ENDED)
      } else setMessage(err.message)
    },
    [signOut],
  )

  async function react(change) {
    if (!user) {
      navigate(loginLink)
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const { reaction, counts } = await reactToArticle(id, change, await getToken())
      setState((current) => ({ ...current, reaction, article: { ...current.article, counts } }))
    } catch (err) {
      await handleError(err)
    } finally {
      setBusy(false)
    }
  }

  async function post(text) {
    setMessage('')
    try {
      const comment = await addArticleComment(id, text, await getToken())
      setState((current) => ({
        ...current,
        comments: [...current.comments, comment],
        article: { ...current.article, counts: { ...current.article.counts, comments: current.article.counts.comments + 1 } },
      }))
      refreshProgress()
      return true
    } catch (err) {
      await handleError(err)
      return false
    }
  }

  async function removeComment(commentId) {
    setMessage('')
    try {
      await deleteArticleComment(commentId, await getToken())
      setState((current) => ({
        ...current,
        comments: current.comments.filter((item) => item.id !== commentId),
        article: { ...current.article, counts: { ...current.article.counts, comments: Math.max(0, current.article.counts.comments - 1) } },
      }))
      refreshProgress()
    } catch (err) {
      await handleError(err)
    }
  }

  async function removeArticle() {
    setMessage('')
    try {
      await deleteArticle(id, await getToken())
      refreshProgress()
      navigate('/articles')
    } catch (err) {
      await handleError(err)
    }
  }

  const { article, comments, reaction } = state

  return (
    <CommunityShell>
      <Link to="/articles" className="font-label text-xs text-ink hover:text-primary">
        &lt; All articles
      </Link>

      {state.status === 'loading' && (
        <p role="status" className="mt-8 font-label text-xs text-muted">
          Opening the article...
        </p>
      )}
      {state.status === 'error' && (
        <div className="mt-8">
          <ErrorNotice message={state.message} />
        </div>
      )}

      {article && (
        <div className="mx-auto mt-6 max-w-3xl">
          <PixelCard as="article" className="relative overflow-hidden p-5 sm:p-10">
            <div aria-hidden="true" className="dither-primary absolute top-0 right-0 h-24 w-1/2 opacity-15" />
            <div className="relative">
              {article.tags.length > 0 && (
                <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
                  {article.tags.map((tag) => (
                    <li key={tag}>
                      <Link to={`/articles?tag=${encodeURIComponent(tag)}`} className="bg-primary-soft px-1.5 py-0.5 font-mono text-xs text-primary hover:bg-primary hover:text-white">
                        #{tag}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <h1 className="mt-4 break-words font-pixel text-3xl font-bold leading-tight text-ink sm:text-4xl">{article.title}</h1>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <AuthorChip author={article.author} meta={dateLine(article)} size="size-10" />
                {article.mine && (
                  <span className="flex flex-wrap items-center gap-2">
                    <PixelButton as={Link} to={`/articles/${article.id}/edit`} variant="secondary" className="px-3 py-2">
                      Edit
                    </PixelButton>
                    <DeleteArticle onDelete={removeArticle} />
                  </span>
                )}
              </div>
              {article.linkedCase && <LinkedCase summary={article.linkedCase} />}
              <div className="mt-8">
                <ArticleBody body={article.body} />
              </div>
              <Reactions article={article} reaction={reaction} busy={busy} onReact={react} />
            </div>
          </PixelCard>

          {message && (
            <div className="mt-6">
              <ErrorNotice message={message} />
            </div>
          )}

          <section aria-labelledby="comments-title" className="mt-12">
            <h2 id="comments-title" className="font-pixel text-2xl font-bold text-ink">
              Comments ({comments.length})
            </h2>
            {comments.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No comments yet. Start the conversation.</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {comments.map((comment) => (
                  <li key={comment.id} className="border-2 border-ink bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <AuthorChip author={comment.author} meta={timeAgo(comment.createdAt)} size="size-7" />
                      {comment.canDelete && (
                        <button type="button" onClick={() => removeComment(comment.id)} aria-label="Delete comment" className="font-label text-[10px] text-muted hover:text-primary">
                          Delete
                        </button>
                      )}
                    </div>
                    <p className="mt-3 whitespace-pre-line break-words text-ink">{comment.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6">
              <Composer user={user} loginLink={loginLink} onPost={post} />
            </div>
          </section>
        </div>
      )}
    </CommunityShell>
  )
}
