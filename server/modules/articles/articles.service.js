import { cleanQuery, COMMUNITY_LIMITS, excerpt, parseTags, SORT_IDS, tagProblem } from '../../../shared/community.js'
import { conceptLabel } from '../../../shared/concepts.js'
import { scanError } from '../../../shared/errorScan.js'
import { handleProblem, normalizeHandle } from '../../../shared/profile.js'
import { getUser } from '../../core/middlewares/auth.js'
import { serverDay } from '../../core/days.js'
import { fail, ok, readJson, requireUser } from '../../core/http.js'
import { getStore } from '../../infra/database/index.js'
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

// GET ?id=: one article with its comments. GET otherwise: a page of search results. No sign in needed.
export async function GET(request) {
  const params = new URL(request.url).searchParams
  const store = getStore()
  const viewer = await getUser(request)

  if (params.has('id')) {
    const article = await store.getArticle(params.get('id'))
    if (!article) return fail(404, NOT_FOUND)
    const comments = await store.listComments(article.id)
    const people = await loadPeople(store, comments.map((item) => item.authorId))
    return ok({
      article: await articleView(store, article, viewer?.id),
      comments: comments.map((item) => commentView(item, people, viewer?.id, article)),
      reaction: viewer ? await store.getReaction(article.id, viewer.id) : null,
    })
  }

  const page = Math.min(Math.max(Number.parseInt(params.get('page') ?? '1', 10) || 1, 1), MAX_PAGE)
  const tag = parseTags(params.get('tag') ?? '')[0] ?? null
  const author = params.has('author') ? normalizeHandle(params.get('author')) : null
  // A tag or handle that can't exist matches nothing (and never reaches the database).
  if ((tag && tagProblem(tag)) || (author !== null && handleProblem(author))) return ok({ articles: [], page, hasMore: false })
  const sort = SORT_IDS.includes(params.get('sort')) ? params.get('sort') : 'new'
  const limit = COMMUNITY_LIMITS.pageSize
  const { articles, hasMore } = await store.searchArticles({
    q: cleanQuery(params.get('q') ?? ''),
    tag,
    authorHandle: author,
    sort,
    offset: (page - 1) * limit,
    limit,
  })
  const people = await loadPeople(store, articles.map((item) => item.authorId))
  return ok({ articles: articles.map((item) => articleSummary(item, people)), page, hasMore })
}

// The case must be on the author's own board.
async function caseProblem(store, userId, caseId) {
  if (!caseId) return null
  return (await store.getCase(userId, caseId)) ? null : fail(400, 'That case is not on your board.')
}

export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  // Demo accounts are free and throwaway: they can read and react, not publish.
  if (auth.user.isDemo) return fail(403, 'Sign up to publish articles.')

  const parsed = parseArticle((await readJson(request)) ?? {})
  if (!parsed.value) return fail(parsed.status, parsed.message)
  const store = getStore()
  const badCase = await caseProblem(store, auth.user.id, parsed.value.caseId)
  if (badCase) return badCase

  const key = articlesKey(auth.user.id)
  const day = serverDay()
  if ((await store.countUsage(key, day)) >= COMMUNITY_LIMITS.articlesPerDay) {
    return fail(429, `You can publish ${COMMUNITY_LIMITS.articlesPerDay} articles a day. Come back tomorrow.`)
  }
  await store.addUsage(key, day)
  const article = await store.createArticle(auth.user.id, parsed.value)
  return ok({ article: await articleView(store, article, auth.user.id) }, 201)
}

export async function PUT(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const body = await readJson(request)
  if (!isText(body?.id)) return fail(400, 'Invalid request.')
  const parsed = parseArticle(body, { partial: true })
  if (!parsed.value) return fail(parsed.status, parsed.message)
  const store = getStore()
  const badCase = await caseProblem(store, auth.user.id, parsed.value.caseId)
  if (badCase) return badCase

  const article = await store.updateArticle(auth.user.id, body.id, parsed.value)
  return article ? ok({ article: await articleView(store, article, auth.user.id) }) : fail(404, NOT_FOUND)
}

export async function DELETE(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return fail(400, 'Invalid request.')
  return (await getStore().deleteArticle(auth.user.id, id)) ? ok({ deleted: true }) : fail(404, NOT_FOUND)
}
