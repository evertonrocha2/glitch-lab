import { fail, ok, readJson, requireUser } from '../../core/http.js'
import { getStore } from '../../infra/database/index.js'
import { loadPeople } from './people.js'

// Only what the bell needs: who did what to which article or event. No user ids.
const notificationView = (item, people) => ({
  id: item.id,
  type: item.type,
  read: item.read,
  articleId: item.articleId,
  articleTitle: item.articleTitle,
  eventId: item.eventId ?? null,
  eventTitle: item.eventTitle ?? null,
  actor: people[item.actorId],
  createdAt: item.createdAt,
})

// GET: my latest notifications, newest first, and how many are unread.
export async function GET(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  const store = getStore()
  const [items, unread] = await Promise.all([store.listNotifications(auth.user.id), store.countUnreadNotifications(auth.user.id)])
  const people = await loadPeople(store, items.map((item) => item.actorId))
  return ok({ notifications: items.map((item) => notificationView(item, people)), unread })
}

// POST { id } marks one as read, { all: true } marks them all. Answers with the new unread count.
export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  const body = await readJson(request)
  const one = typeof body?.id === 'string' && body.id.length <= 64
  if (!one && body?.all !== true) return fail(400, 'Invalid request.')
  const store = getStore()
  await store.markNotificationsRead(auth.user.id, one ? body.id : undefined)
  return ok({ unread: await store.countUnreadNotifications(auth.user.id) })
}
