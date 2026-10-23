import { cleanQuery, COMMUNITY_LIMITS, excerpt, parseTags, SORT_IDS, tagProblem } from '../../../shared/community.js'
import { conceptLabel } from '../../../shared/concepts.js'
import { scanError } from '../../../shared/errorScan.js'
import { handleProblem, normalizeHandle } from '../../../shared/profile.js'
import { isQuestion } from '../../../shared/question.js'
import { serverDay } from '../../core/days.js'
import { badRequest, forbidden, notFound, tooMany, valueOrThrow } from '../../core/errors.js'
import { spendUsage } from '../../core/usage.js'
import { pageOf } from '../../core/validation.js'
import { loadPeople } from './people.js'
import { commentView } from './comments.service.js'

const INVALID = { status: 400, message: 'Invalid request.' }
const NOT_FOUND = 'Article not found.'
const MAX_PAGE = 500
const isText = (value) => typeof value === 'string'

// The daily publishing limit sits in the usage table, next to the AI limit but under its own key.
export const articlesKey = (userId) => `articles:${userId}`

export const counts = (article) => ({ likes: article.likeCount, valid: article.validCount, bad: article.badCount, comments: article.commentCount })

function parseTagList(value) {
  if (!Array.isArray(value) || !value.every(isText)) return INVALID
  const tags = parseTags(value)
  if (tags.length > COMMUNITY_LIMITS.tags) return { status: 400, message: `Use up to ${COMMUNITY_LIMITS.tags} tags.` }
  const problem = tags.map(tagProblem).find(Boolean)
  return problem ? { status: 400, message: problem } : { tags }
}

// { value } with only the fields sent, cleaned up, or { status, message }. partial: an edit.
export function parseArticle(body, { partial = false } = {}) {
  const value = {}
  if (body.title !== undefined || !partial) {
    if (!isText(body.title)) return INVALID
    const title = body.title.trim()
    if (!title) return { status: 400, message: 'Give your article a title.' }
    if (title.length > COMMUNITY_LIMITS.title) return { status: 413, message: `Too long. Keep the title under ${COMMUNITY_LIMITS.title + 1} characters.` }
    value.title = title
  }
  if (body.body !== undefined || !partial) {
    if (!isText(body.body)) return INVALID
    const text = body.body.trim()
    if (!text) return { status: 400, message: 'Write something before you publish.' }
    if (text.length > COMMUNITY_LIMITS.body) return { status: 413, message: `Too long. Keep the article under ${COMMUNITY_LIMITS.body + 1} characters.` }
    value.body = text
  }
  if (body.tags !== undefined || !partial) {
    const parsed = parseTagList(body.tags ?? [])
    if (!parsed.tags) return parsed
    value.tags = parsed.tags
  }
  if (body.caseId !== undefined && body.caseId !== null) {
    if (!isText(body.caseId) || !body.caseId || body.caseId.length > 64) return INVALID
    value.caseId = body.caseId
  } else if (body.caseId === null || !partial) value.caseId = null
  return { value }
}

// A linked case shows only what kind of bug it was: never its code, error text or id.
async function linkedCase(store, article) {
  if (!article.caseId) return null
  const found = await store.getCase(article.authorId, article.caseId)
  if (!found) return null
  // A question card names its topic where an error names its type.
  if (isQuestion(found)) return { kind: 'question', errorType: found.topic, concept: conceptLabel(found.concept), language: found.language }
  return { errorType: scanError(found.error).type ?? 'Error', concept: conceptLabel(found.concept), language: found.language }
}

export function articleSummary(article, people) {
  return {
    id: article.id,
    title: article.title,
    excerpt: excerpt(article.body),
    tags: article.tags,
    author: people[article.authorId],
    counts: counts(article),
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  }
}

// The full article. Its author also gets the linked case id back, for the editor.
async function articleView(store, article, viewerId) {
  const people = await loadPeople(store, [article.authorId])
  const mine = viewerId === article.authorId
  const { excerpt: _excerpt, ...summary } = articleSummary(article, people)
  return {
    ...summary,
    body: article.body,
    mine,
    linkedCase: await linkedCase(store, article),
    ...(mine ? { caseId: article.caseId } : {}),
  }
}

// One article with its comments, and my reaction when I'm signed in. No sign in needed.
export async function getArticle(store, id, viewer) {
  const article = await store.getArticle(id)
  if (!article) throw notFound(NOT_FOUND)
  const comments = await store.listComments(article.id)
  const people = await loadPeople(store, comments.map((item) => item.authorId))
  return {
    article: await articleView(store, article, viewer?.id),
    comments: comments.map((item) => commentView(item, people, viewer?.id, article)),
    reaction: viewer ? await store.getReaction(article.id, viewer.id) : null,
  }
}

// A page of search results ({ q, tag, author, sort, page }, all optional strings). No sign in needed.
export async function searchArticles(store, query) {
  const page = pageOf(query.page, MAX_PAGE)
  const tag = parseTags(query.tag ?? '')[0] ?? null
  const author = query.author !== null && query.author !== undefined ? normalizeHandle(query.author) : null
  // A tag or handle that can't exist matches nothing (and never reaches the database).
  if ((tag && tagProblem(tag)) || (author !== null && handleProblem(author))) return { articles: [], page, hasMore: false }
  const sort = SORT_IDS.includes(query.sort) ? query.sort : 'new'
  const limit = COMMUNITY_LIMITS.pageSize
  const { articles, hasMore } = await store.searchArticles({
    q: cleanQuery(query.q ?? ''),
    tag,
    authorHandle: author,
    sort,
    offset: (page - 1) * limit,
    limit,
  })
  const people = await loadPeople(store, articles.map((item) => item.authorId))
  return { articles: articles.map((item) => articleSummary(item, people)), page, hasMore }
}

// The case must be on the author's own board.
async function checkCase(store, userId, caseId) {
  if (caseId && !(await store.getCase(userId, caseId))) throw badRequest('That case is not on your board.')
}

export async function createArticle(store, user, body) {
  // Demo accounts are free and throwaway: they can read and react, not publish.
  if (user.isDemo) throw forbidden('Sign up to publish articles.')

  const value = valueOrThrow(parseArticle(body ?? {}))
  await checkCase(store, user.id, value.caseId)

  if (!(await spendUsage(store, articlesKey(user.id), serverDay(), COMMUNITY_LIMITS.articlesPerDay))) {
    throw tooMany(`You can publish ${COMMUNITY_LIMITS.articlesPerDay} articles a day. Come back tomorrow.`)
  }
  const article = await store.createArticle(user.id, value)
  return articleView(store, article, user.id)
}

// Only the fields sent change; only the author can change it.
export async function updateArticle(store, user, id, body) {
  if (!body) throw badRequest()
  const value = valueOrThrow(parseArticle(body, { partial: true }))
  await checkCase(store, user.id, value.caseId)

  const article = await store.updateArticle(user.id, id, value)
  if (!article) throw notFound(NOT_FOUND)
  return articleView(store, article, user.id)
}

export async function deleteArticle(store, user, id) {
  if (!(await store.deleteArticle(user.id, id))) throw notFound(NOT_FOUND)
}
