import { COMMUNITY_LIMITS } from '../../../shared/community.js'
import { serverDay } from '../../core/days.js'
import { fail, ok, readJson, requireUser } from '../../core/http.js'
import { getStore } from '../../infra/database/index.js'
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

// GET ?articleId=: the article's comments, oldest first. No sign in needed.
export async function GET(request) {
  const articleId = new URL(request.url).searchParams.get('articleId')
  if (!articleId) return fail(400, 'Invalid request.')
  const store = getStore()
  const article = await store.getArticle(articleId)
  if (!article) return fail(404, 'Article not found.')
  const comments = await store.listComments(article.id)
  const people = await loadPeople(store, comments.map((item) => item.authorId))
  return ok({ comments: comments.map((item) => commentView(item, people, null, article)) })
}

export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  // A comment is public text: throwaway demo accounts can't post one.
  if (auth.user.isDemo) return fail(403, 'Sign up to comment on articles.')

  const body = await readJson(request)
  if (!isText(body?.articleId) || !isText(body.body)) return fail(400, 'Invalid request.')
  const text = body.body.trim()
  if (!text) return fail(400, 'Write something before you post.')
  if (text.length > COMMUNITY_LIMITS.comment) return fail(413, `Too long. Keep your comment under ${COMMUNITY_LIMITS.comment + 1} characters.`)

  const store = getStore()
  const article = await store.getArticle(body.articleId)
  if (!article) return fail(404, 'Article not found.')
  const key = commentsKey(auth.user.id)
  const day = serverDay()
  if ((await store.countUsage(key, day)) >= COMMUNITY_LIMITS.commentsPerDay) {
    return fail(429, `You can post ${COMMUNITY_LIMITS.commentsPerDay} comments a day. Come back tomorrow.`)
  }
  await store.addUsage(key, day)

  const comment = await store.createComment(auth.user.id, article.id, text)
  if (article.authorId !== auth.user.id) {
    await store.addNotification({ userId: article.authorId, type: 'comment', actorId: auth.user.id, articleId: article.id })
  }
  const people = await loadPeople(store, [auth.user.id])
  return ok({ comment: commentView(comment, people, auth.user.id, article) }, 201)
}

export async function DELETE(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return fail(400, 'Invalid request.')
  const store = getStore()
  const comment = await store.getComment(id)
  if (!comment) return fail(404, 'Comment not found.')
  const article = await store.getArticle(comment.articleId)
  if (!article || !canDelete(comment, auth.user.id, article)) return fail(403, 'You can only delete your own comments.')
  await store.deleteComment(id)
  return ok({ deleted: true })
}
