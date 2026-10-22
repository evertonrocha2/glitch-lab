import { randomUUID } from 'node:crypto'
import { profileFromUser } from './profileShape.js'
import { cleanQuery } from '../../../shared/community.js'

const now = () => new Date().toISOString()
const copy = (value) => (value == null ? null : structuredClone(value))
const NO_REACTION = { liked: false, rating: null }

// Profile fields as the main local store hands them out (accounts made before profiles default them).
const toProfile = profileFromUser

// Community articles, comments, reactions and notifications for the JSON file store.
// Spread into createLocalStore, sharing its load and save so every write lands in the same file.
export function createLocalCommunity({ load, save }) {
  // Files saved before the community existed don't have these lists yet.
  const lists = (data) => {
    data.articles ??= []
    data.comments ??= []
    data.reactions ??= []
    data.notifications ??= []
    return data
  }
  const articleById = (data, id) => lists(data).articles.find((item) => item.id === id)

  // Counts live on the article, so lists and sorting never have to add them up.
  function recount(data, articleId) {
    const found = articleById(data, articleId)
    if (!found) return
    const reactions = data.reactions.filter((item) => item.articleId === articleId)
    found.likeCount = reactions.filter((item) => item.liked).length
    found.validCount = reactions.filter((item) => item.rating === 'valid').length
    found.badCount = reactions.filter((item) => item.rating === 'bad').length
    found.commentCount = data.comments.filter((item) => item.articleId === articleId).length
  }

  function matches(data, item, q) {
    if (!q) return true
    const needle = q.toLowerCase()
    if (item.title.toLowerCase().includes(needle) || item.body.toLowerCase().includes(needle)) return true
    if (item.tags.includes(needle)) return true
    const author = data.users?.find((user) => user.id === item.authorId)
    return Boolean(author && [author.handle, author.displayName].some((value) => value?.toLowerCase().includes(needle)))
  }

  return {
    async createArticle(authorId, { title, body, tags, caseId = null }) {
      const data = lists(await load())
      const stamp = now()
      const created = {
        id: randomUUID(),
        authorId,
        title,
        body,
        tags,
        caseId,
        likeCount: 0,
        validCount: 0,
        badCount: 0,
        commentCount: 0,
        createdAt: stamp,
        updatedAt: stamp,
      }
      data.articles.push(created)
      await save()
      return copy(created)
    },

    async getArticle(id) {
      return copy(articleById(await load(), id))
    },

    async updateArticle(authorId, id, { title, body, tags, caseId }) {
      const found = articleById(await load(), id)
      if (!found || found.authorId !== authorId) return null
      if (title !== undefined) found.title = title
      if (body !== undefined) found.body = body
      if (tags !== undefined) found.tags = [...tags]
      if (caseId !== undefined) found.caseId = caseId
      found.updatedAt = now()
      await save()
      return copy(found)
    },

    // Its comments, reactions and notifications go with it.
    async deleteArticle(authorId, id) {
      const data = lists(await load())
      const index = data.articles.findIndex((item) => item.id === id && item.authorId === authorId)
      if (index === -1) return false
      data.articles.splice(index, 1)
      data.comments = data.comments.filter((item) => item.articleId !== id)
      data.reactions = data.reactions.filter((item) => item.articleId !== id)
      data.notifications = data.notifications.filter((item) => item.articleId !== id)
      await save()
      return true
    },

    // q matches the title, body, an exact tag or the author's handle or name. { articles, hasMore }.
    async searchArticles({ q = '', tag = null, authorHandle = null, sort = 'new', offset = 0, limit = 10 }) {
      const data = lists(await load())
      const needle = cleanQuery(q)
      let authorId
      if (authorHandle) {
        authorId = data.users?.find((user) => user.handle && user.handle === authorHandle.toLowerCase())?.id
        if (!authorId) return { articles: [], hasMore: false }
      }
      // Newest first: later in the list is newer.
      const found = [...data.articles]
        .reverse()
        .filter((item) => (!tag || item.tags.includes(tag)) && (!authorId || item.authorId === authorId) && matches(data, item, needle))
      const count = sort === 'top' ? 'likeCount' : sort === 'valid' ? 'validCount' : null
      if (count) found.sort((a, b) => b[count] - a[count])
      return { articles: copy(found.slice(offset, offset + limit)), hasMore: found.length > offset + limit }
    },

    async createComment(authorId, articleId, body) {
      const data = lists(await load())
      const created = { id: randomUUID(), articleId, authorId, body, createdAt: now() }
      data.comments.push(created)
      recount(data, articleId)
      await save()
      return copy(created)
    },

    // Oldest first, like a conversation.
    async listComments(articleId) {
      return copy(lists(await load()).comments.filter((item) => item.articleId === articleId))
    },

    async getComment(id) {
      return copy(lists(await load()).comments.find((item) => item.id === id))
    },

    async deleteComment(id) {
      const data = lists(await load())
      const index = data.comments.findIndex((item) => item.id === id)
      if (index === -1) return false
      const [removed] = data.comments.splice(index, 1)
      recount(data, removed.articleId)
      await save()
      return true
    },

    async getReaction(articleId, userId) {
      const found = lists(await load()).reactions.find((item) => item.articleId === articleId && item.userId === userId)
      return found ? { liked: found.liked, rating: found.rating } : { ...NO_REACTION }
    },

    // liked / rating left undefined stay as they were; rating null removes it. fromDemo keeps it out of XP.
    async setReaction(articleId, userId, { liked, rating, fromDemo = false }) {
      const data = lists(await load())
      const index = data.reactions.findIndex((item) => item.articleId === articleId && item.userId === userId)
      const current = index === -1 ? { articleId, userId, ...NO_REACTION } : data.reactions[index]
      const next = {
        ...current,
        liked: liked ?? current.liked,
        rating: rating === undefined ? current.rating : rating,
        fromDemo: Boolean(fromDemo),
      }
      if (index !== -1) data.reactions.splice(index, 1)
      if (next.liked || next.rating) data.reactions.push(next)
      recount(data, articleId)
      await save()
      return { liked: next.liked, rating: next.rating }
    },

    async communityStats(userId) {
      const data = lists(await load())
      const mine = new Set(data.articles.filter((item) => item.authorId === userId).map((item) => item.id))
      const received = data.reactions.filter((item) => mine.has(item.articleId) && !item.fromDemo)
      return {
        articles: mine.size,
        likesReceived: received.filter((item) => item.liked).length,
        validReceived: received.filter((item) => item.rating === 'valid').length,
        comments: data.comments.filter((item) => item.authorId === userId).length,
      }
    },

    // { [userId]: profile } for the ids that have an account.
    async getProfiles(userIds) {
      const wanted = new Set(userIds)
      const users = ((await load()).users ?? []).filter((user) => wanted.has(user.id))
      return Object.fromEntries(users.map((user) => [user.id, toProfile(user)]))
    },

    // A like or rating is announced once per person and article; null when it already was.
    async addNotification({ userId, type, actorId, articleId }) {
      const data = lists(await load())
      const repeat =
        type !== 'comment' &&
        data.notifications.some((item) => item.userId === userId && item.type === type && item.actorId === actorId && item.articleId === articleId)
      if (repeat) return null
      const created = { id: randomUUID(), userId, type, actorId, articleId, read: false, createdAt: now() }
      data.notifications.push(created)
      await save()
      return copy(created)
    },

    // Newest first, each with its article's title.
    async listNotifications(userId, limit = 30) {
      const data = lists(await load())
      return data.notifications
        .filter((item) => item.userId === userId)
        .reverse()
        .slice(0, limit)
        .map((item) => ({ ...copy(item), articleTitle: articleById(data, item.articleId)?.title ?? null }))
    },

    async countUnreadNotifications(userId) {
      return lists(await load()).notifications.filter((item) => item.userId === userId && !item.read).length
    },

    // One (by id) or all of the person's notifications. Returns how many changed.
    async markNotificationsRead(userId, id) {
      const data = lists(await load())
      const changed = data.notifications.filter((item) => item.userId === userId && !item.read && (!id || item.id === id))
      for (const item of changed) item.read = true
      if (changed.length) await save()
      return changed.length
    },
  }
}
