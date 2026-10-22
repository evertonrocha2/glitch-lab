import { cleanQuery } from '../../../shared/community.js'

// Postgres "invalid input syntax for type uuid": a malformed id simply matches nothing.
const INVALID_UUID = '22P02'
const NO_REACTION = { liked: false, rating: null }
const SORT_COLUMNS = { top: 'like_count', valid: 'valid_count' }

const toArticle = (row) =>
  row && {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    body: row.body,
    tags: row.tags ?? [],
    caseId: row.case_id ?? null,
    likeCount: row.like_count,
    validCount: row.valid_count,
    badCount: row.bad_count,
    commentCount: row.comment_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

const toComment = (row) => row && { id: row.id, articleId: row.article_id, authorId: row.author_id, body: row.body, createdAt: row.created_at }

const toNotification = (row) =>
  row && {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    actorId: row.actor_id,
    articleId: row.article_id,
    read: row.read,
    createdAt: row.created_at,
  }

const toProfile = (row) => ({
  handle: row.handle ?? null,
  displayName: row.display_name ?? null,
  bio: row.bio ?? '',
  avatar: row.avatar ?? null,
  featuredBadges: row.featured_badges ?? [],
  isPublic: row.is_public ?? false,
  createdAt: row.created_at,
})

const defined = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined))

function unwrap({ data, error }) {
  if (error?.code === INVALID_UUID) return null
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

// The rows a count query matched (head: true asks for the number only).
function counted({ count, error }) {
  if (error?.code === INVALID_UUID) return 0
  if (error) throw new Error(`Supabase: ${error.message}`)
  return count ?? 0
}

// Community articles, comments, reactions and notifications on Supabase. Spread into createSupabaseStore.
export function createSupabaseCommunity(db) {
  // Counts live on the article row; one SQL function recounts them after every change.
  const recount = async (articleId) => unwrap(await db.rpc('refresh_article_counts', { p_article: articleId }))
  const count = (table) => db.from(table).select('*', { count: 'exact', head: true })
  async function getReaction(articleId, userId) {
    const row = unwrap(await db.from('article_reactions').select('liked, rating').eq('article_id', articleId).eq('user_id', userId).maybeSingle())
    return row ? { liked: row.liked, rating: row.rating } : { ...NO_REACTION }
  }

  return {
    async createArticle(authorId, { title, body, tags, caseId = null }) {
      return toArticle(unwrap(await db.from('articles').insert({ author_id: authorId, title, body, tags, case_id: caseId }).select().single()))
    },

    async getArticle(id) {
      return toArticle(unwrap(await db.from('articles').select('*').eq('id', id).maybeSingle()))
    },

    async updateArticle(authorId, id, { title, body, tags, caseId }) {
      const patch = defined({ title, body, tags, case_id: caseId, updated_at: new Date().toISOString() })
      return toArticle(unwrap(await db.from('articles').update(patch).eq('id', id).eq('author_id', authorId).select().maybeSingle()))
    },

    // Comments, reactions and notifications go with it (on delete cascade).
    async deleteArticle(authorId, id) {
      const rows = unwrap(await db.from('articles').delete().eq('id', id).eq('author_id', authorId).select('id'))
      return (rows ?? []).length > 0
    },

    // q is cleaned down to letters, numbers and a few symbols, then quoted, so it can't change the filter.
    async searchArticles({ q = '', tag = null, authorHandle = null, sort = 'new', offset = 0, limit = 10 }) {
      let query = db.from('articles').select('*')
      if (authorHandle) {
        const author = unwrap(await db.from('users').select('id').eq('handle', authorHandle.toLowerCase()).maybeSingle())
        if (!author) return { articles: [], hasMore: false }
        query = query.eq('author_id', author.id)
      }
      if (tag) query = query.contains('tags', [tag])
      const needle = cleanQuery(q)
      if (needle) {
        const pattern = `"%${needle}%"`
        const authors = unwrap(
          await db.from('users').select('id').or(`handle.ilike.${pattern},display_name.ilike.${pattern}`).limit(50),
        )
        const filters = [`title.ilike.${pattern}`, `body.ilike.${pattern}`, `tags.cs.{"${needle.toLowerCase()}"}`]
        if (authors?.length) filters.push(`author_id.in.(${authors.map((row) => row.id).join(',')})`)
        query = query.or(filters.join(','))
      }
      if (SORT_COLUMNS[sort]) query = query.order(SORT_COLUMNS[sort], { ascending: false })
      // One extra row says whether there is another page.
      const rows = unwrap(await query.order('created_at', { ascending: false }).range(offset, offset + limit)) ?? []
      return { articles: rows.slice(0, limit).map(toArticle), hasMore: rows.length > limit }
    },

    async createComment(authorId, articleId, body) {
      const row = unwrap(await db.from('article_comments').insert({ article_id: articleId, author_id: authorId, body }).select().single())
      await recount(articleId)
      return toComment(row)
    },

    async listComments(articleId) {
      const rows = unwrap(await db.from('article_comments').select('*').eq('article_id', articleId).order('created_at', { ascending: true }))
      return (rows ?? []).map(toComment)
    },

    async getComment(id) {
      return toComment(unwrap(await db.from('article_comments').select('*').eq('id', id).maybeSingle()))
    },

    async deleteComment(id) {
      const rows = unwrap(await db.from('article_comments').delete().eq('id', id).select('article_id'))
      if (!rows?.length) return false
      await recount(rows[0].article_id)
      return true
    },

    getReaction,

    // liked / rating left undefined stay as they were; rating null removes it. fromDemo keeps it out of XP.
    async setReaction(articleId, userId, { liked, rating, fromDemo = false }) {
      const current = await getReaction(articleId, userId)
      const next = { liked: liked ?? current.liked, rating: rating === undefined ? current.rating : rating }
      if (next.liked || next.rating) {
        // The author is copied onto the reaction so "what did my articles receive" is one count.
        const article = unwrap(await db.from('articles').select('author_id').eq('id', articleId).maybeSingle())
        if (!article) return { ...NO_REACTION }
        const row = { article_id: articleId, user_id: userId, author_id: article.author_id, ...next, from_demo: Boolean(fromDemo) }
        unwrap(await db.from('article_reactions').upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'article_id,user_id' }))
      } else {
        unwrap(await db.from('article_reactions').delete().eq('article_id', articleId).eq('user_id', userId))
      }
      await recount(articleId)
      return next
    },

    async communityStats(userId) {
      const received = (query) => query.eq('author_id', userId).eq('from_demo', false)
      const [articles, likesReceived, validReceived, comments] = await Promise.all([
        count('articles').eq('author_id', userId),
        received(count('article_reactions')).eq('liked', true),
        received(count('article_reactions')).eq('rating', 'valid'),
        count('article_comments').eq('author_id', userId),
      ])
      return { articles: counted(articles), likesReceived: counted(likesReceived), validReceived: counted(validReceived), comments: counted(comments) }
    },

    async getProfiles(userIds) {
      const unique = [...new Set(userIds)]
      if (!unique.length) return {}
      const rows = unwrap(
        await db.from('users').select('id, handle, display_name, bio, avatar, featured_badges, is_public, created_at').in('id', unique),
      )
      return Object.fromEntries((rows ?? []).map((row) => [row.id, toProfile(row)]))
    },

    // A like or rating is announced once per person and article; null when it already was.
    async addNotification({ userId, type, actorId, articleId }) {
      if (type !== 'comment') {
        const seen = unwrap(
          await db
            .from('notifications')
            .select('id')
            .eq('user_id', userId)
            .eq('type', type)
            .eq('actor_id', actorId)
            .eq('article_id', articleId)
            .limit(1),
        )
        if (seen?.length) return null
      }
      const row = unwrap(await db.from('notifications').insert({ user_id: userId, type, actor_id: actorId, article_id: articleId }).select().single())
      return toNotification(row)
    },

    async listNotifications(userId, limit = 30) {
      const rows = unwrap(
        await db
          .from('notifications')
          .select('*, articles(title)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit),
      )
      return (rows ?? []).map((row) => ({ ...toNotification(row), articleTitle: row.articles?.title ?? null }))
    },

    async countUnreadNotifications(userId) {
      return counted(await count('notifications').eq('user_id', userId).eq('read', false))
    },

    async markNotificationsRead(userId, id) {
      let query = db.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
      if (id) query = query.eq('id', id)
      const rows = unwrap(await query.select('id'))
      return (rows ?? []).length
    },
  }
}
