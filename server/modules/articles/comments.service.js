import { COMMUNITY_LIMITS } from '../../../shared/community.js'
import { serverDay } from '../../core/days.js'
import { badRequest, forbidden, notFound, tooLarge, tooMany } from '../../core/errors.js'
import { spendUsage } from '../../core/usage.js'
import { loadPeople } from './people.js'

const isText = (value) => typeof value === 'string'
const commentsKey = (userId) => `comments:${userId}`

// The comment's author and the article's author may delete it.
const canDelete = (comment, viewerId, article) => Boolean(viewerId) && (comment.authorId === viewerId || article.authorId === viewerId)

export function commentView(comment, people, viewerId, article) {
  return {
    id: comment.id,
    body: comment.body,
    author: people[comment.authorId],
    canDelete: canDelete(comment, viewerId, article),
    createdAt: comment.createdAt,
  }
}

// The article's comments, oldest first. No sign in needed.
export async function listComments(store, articleId) {
  const article = await store.getArticle(articleId)
  if (!article) throw notFound('Article not found.')
  const comments = await store.listComments(article.id)
  const people = await loadPeople(store, comments.map((item) => item.authorId))
  return comments.map((item) => commentView(item, people, null, article))
}

// { body }: a comment on an article. Its author hears about it (unless it's their own).
export async function addComment(store, user, articleId, input) {
  // A comment is public text: throwaway demo accounts can't post one.
  if (user.isDemo) throw forbidden('Sign up to comment on articles.')

  if (!isText(input?.body)) throw badRequest()
  const text = input.body.trim()
  if (!text) throw badRequest('Write something before you post.')
  if (text.length > COMMUNITY_LIMITS.comment) throw tooLarge(`Too long. Keep your comment under ${COMMUNITY_LIMITS.comment + 1} characters.`)

  const article = await store.getArticle(articleId)
  if (!article) throw notFound('Article not found.')
  if (!(await spendUsage(store, commentsKey(user.id), serverDay(), COMMUNITY_LIMITS.commentsPerDay))) {
    throw tooMany(`You can post ${COMMUNITY_LIMITS.commentsPerDay} comments a day. Come back tomorrow.`)
  }

  const comment = await store.createComment(user.id, article.id, text)
  if (article.authorId !== user.id) {
    await store.addNotification({ userId: article.authorId, type: 'comment', actorId: user.id, articleId: article.id })
  }
  const people = await loadPeople(store, [user.id])
  return commentView(comment, people, user.id, article)
}

export async function deleteComment(store, user, id) {
  const comment = await store.getComment(id)
  if (!comment) throw notFound('Comment not found.')
  const article = await store.getArticle(comment.articleId)
  if (!article || !canDelete(comment, user.id, article)) throw forbidden('You can only delete your own comments.')
  await store.deleteComment(id)
}
