import { RATINGS } from '../../../shared/community.js'
import { fail, ok, readJson, requireUser } from '../http.js'
import { getStore } from '../store/index.js'
import { counts } from './articles.js'

// POST { articleId, like?: boolean, rating?: 'valid' | 'bad' | null }: one like and one rating per person.
export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const body = await readJson(request)
  if (typeof body?.articleId !== 'string') return fail(400, 'Invalid request.')
  const { like, rating } = body
  if (like === undefined && rating === undefined) return fail(400, 'Invalid request.')
  if (like !== undefined && typeof like !== 'boolean') return fail(400, 'Invalid request.')
  if (rating !== undefined && rating !== null && !RATINGS.includes(rating)) return fail(400, 'Invalid request.')

  const store = getStore()
  const article = await store.getArticle(body.articleId)
  if (!article) return fail(404, 'Article not found.')
  // Liking or rating your own article would be free XP.
  if (article.authorId === auth.user.id) {
    return fail(403, rating !== undefined ? "You can't rate your own article." : "You can't like your own article.")
  }

  const before = await store.getReaction(article.id, auth.user.id)
  // Demo reactions show up in the counts, but earn the author no XP (demo accounts are free to make).
  const reaction = await store.setReaction(article.id, auth.user.id, { liked: like, rating, fromDemo: auth.user.isDemo })

  // The store announces each like or rating only once, so toggling never spams the author.
  const notify = (type) => store.addNotification({ userId: article.authorId, type, actorId: auth.user.id, articleId: article.id })
  if (reaction.liked && !before.liked) await notify('like')
  if (reaction.rating && reaction.rating !== before.rating) await notify(`rating_${reaction.rating}`)

  return ok({ reaction, counts: counts(await store.getArticle(article.id)) })
}
