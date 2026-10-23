import * as articles from '../server/modules/articles/articles.service.js'
import * as comments from '../server/modules/articles/comments.service.js'
import * as notifications from '../server/modules/articles/notifications.service.js'
import * as reactions from '../server/modules/articles/reactions.service.js'
import { fail } from '../server/core/http.js'
import { EVENT_RESOURCES } from '../server/modules/events/index.js'

// Community articles in one function (Vercel's free plan allows 12): ?resource= picks the handler.
const RESOURCES = { articles, comments, reactions, notifications }
// Community events: events, event-entries and event-votes (see _lib/events).
Object.assign(RESOURCES, EVENT_RESOURCES)

function route(method) {
  return (request) => {
    const resource = RESOURCES[new URL(request.url).searchParams.get('resource')]
    if (!resource) return fail(404, 'Not found.')
    const handler = resource[method]
    return typeof handler === 'function' ? handler(request) : fail(405, 'Method not allowed.')
  }
}

export const GET = route('GET')
export const POST = route('POST')
export const PUT = route('PUT')
export const DELETE = route('DELETE')
