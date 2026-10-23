import { badRequest } from '../../core/errors.js'
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

// My latest notifications, newest first, and how many are unread.
export async function listNotifications(store, user) {
  const [items, unread] = await Promise.all([store.listNotifications(user.id), store.countUnreadNotifications(user.id)])
  const people = await loadPeople(store, items.map((item) => item.actorId))
  return { notifications: items.map((item) => notificationView(item, people)), unread }
}

// { id } marks one as read, { all: true } marks them all. Answers with the new unread count.
export async function markRead(store, user, body) {
  const one = typeof body?.id === 'string' && body.id.length <= 64
  if (!one && body?.all !== true) throw badRequest()
  await store.markNotificationsRead(user.id, one ? body.id : undefined)
  return { unread: await store.countUnreadNotifications(user.id) }
}
