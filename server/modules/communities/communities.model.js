import { COMMUNITY_COLORS, COMMUNITY_ICONS, COMMUNITY_TOPICS, cleanBody, MESSAGE_LIMITS } from '../../../shared/messages.js'
import { badRequest, tooLarge } from '../../core/errors.js'

const { nameMin, nameMax, description: DESCRIPTION, topics: TOPICS } = MESSAGE_LIMITS
// A name is one line: control characters and line breaks become spaces, runs of spaces one.
const ONE_LINE = /[\u0000-\u001f\u007f]+/g

// { name, description, topics, color, icon } from the create form, checked.
export function parseCommunity(input) {
  if (!input || typeof input.name !== 'string') throw badRequest()
  const name = input.name.replace(ONE_LINE, ' ').replace(/\s+/g, ' ').trim()
  if (name.length < nameMin || name.length > nameMax) throw badRequest(`Name the community with ${nameMin} to ${nameMax} characters.`)

  if (input.description !== undefined && typeof input.description !== 'string') throw badRequest()
  const description = cleanBody(input.description ?? '')
  if (description.length > DESCRIPTION) throw tooLarge(`Too long. Keep the description under ${DESCRIPTION + 1} characters.`)

  const topics = input.topics ?? []
  if (!Array.isArray(topics) || topics.some((topic) => !COMMUNITY_TOPICS.includes(topic))) throw badRequest('Pick topics from the list.')
  const unique = [...new Set(topics)]
  if (unique.length > TOPICS) throw badRequest(`Pick up to ${TOPICS} topics.`)

  const color = input.color ?? COMMUNITY_COLORS[0]
  const icon = input.icon ?? COMMUNITY_ICONS[0]
  if (!COMMUNITY_COLORS.includes(color) || !COMMUNITY_ICONS.includes(icon)) throw badRequest('Pick a color and an icon from the list.')
  return { name, description, topics: unique, color, icon }
}

// Slugs in paths: what slugify makes, nothing else.
const SLUG = /^[a-z0-9][a-z0-9-]{0,47}$/
export const isSlug = (value) => typeof value === 'string' && SLUG.test(value)
