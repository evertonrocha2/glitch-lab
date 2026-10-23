import { RATINGS } from '../../../shared/community.js'
import { badRequest, forbidden, notFound } from '../../core/errors.js'
import { counts } from './articles.service.js'

// { like?: boolean, rating?: 'valid' | 'bad' | null }: one like and one rating per person.
// Answers { reaction, counts }.
export async function react(store, user, articleId, body) {
  if (!body) throw badRequest()
  const { like, rating } = body
  if (like === undefined && rating === undefined) throw badRequest()
  if (like !== undefined && typeof like !== 'boolean') throw badRequest()
  if (rating !== undefined && rating !== null && !RATINGS.includes(rating)) throw badRequest()

  // Demo accounts are free and unlimited: they'd skew counts, rankings and notifications.
  if (user.isDemo) throw forbidden('Sign up to like and rate articles.')

  const article = await store.getArticle(articleId)
  if (!article) throw notFound('Article not found.')
  // Liking or rating your own article would be free XP.
  if (article.authorId === user.id) {
    throw forbidden(rating !== undefined ? "You can't rate your own article." : "You can't like your own article.")
  }

  const before = await store.getReaction(article.id, user.id)
  // Demo reactions show up in the counts, but earn the author no XP (demo accounts are free to make).
  const reaction = await store.setReaction(article.id, user.id, { liked: like, rating, fromDemo: user.isDemo })

  // The store announces each like or rating only once, so toggling never spams the author.
  const notify = (type) => store.addNotification({ userId: article.authorId, type, actorId: user.id, articleId: article.id })
  if (reaction.liked && !before.liked) await notify('like')
  if (reaction.rating && reaction.rating !== before.rating) await notify(`rating_${reaction.rating}`)

  return { reaction, counts: counts(await store.getArticle(article.id)) }
}
