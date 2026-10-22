import * as articles from './_lib/community/articles.js'
import * as comments from './_lib/community/comments.js'
import * as notifications from './_lib/community/notifications.js'
import * as reactions from './_lib/community/reactions.js'
import { fail } from './_lib/http.js'

// Community articles in one function (Vercel's free plan allows 12): ?resource= picks the handler.
const RESOURCES = { articles, comments, reactions, notifications }

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
