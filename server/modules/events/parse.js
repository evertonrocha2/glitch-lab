import { COMMUNITY_LIMITS, parseTags, tagProblem } from '../../../shared/community.js'
import { DEFAULT_REQUIREMENTS, EVENT_KINDS, EVENT_LIMITS, LINK_KINDS, linkProblem, requirementAllowed, VOTING_MS } from '../../../shared/events.js'

const INVALID = { status: 400, message: 'Invalid request.' }
const isText = (value) => typeof value === 'string'
const tooLong = (what, max) => ({ status: 413, message: `Too long. Keep your ${what} under ${max + 1} characters.` })
// Control characters other than line breaks and tabs never reach the store.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g

// One line: spaces squeezed, no breaks. Several paragraphs: line breaks kept, nothing else odd.
const oneLine = (value) => value.replace(CONTROL, '').replace(/\s+/g, ' ').trim()
const paragraphs = (value) => value.replace(/\r\n?/g, '\n').replace(CONTROL, '').trim()

// { text } or { status, message }. empty: the message for a required field left blank.
function textField(value, { max, what, multiline = false, empty = null }) {
  if (value === undefined || value === null) value = ''
  if (!isText(value)) return INVALID
  const text = multiline ? paragraphs(value) : oneLine(value)
  if (!text && empty) return { status: 400, message: empty }
  if (text.length > max) return tooLong(what, max)
  return { text }
}

function parseTagList(value) {
  if (!Array.isArray(value) || !value.every(isText)) return INVALID
  const tags = parseTags(value)
  if (tags.length > COMMUNITY_LIMITS.tags) return { status: 400, message: `Use up to ${COMMUNITY_LIMITS.tags} tags.` }
  const problem = tags.map(tagProblem).find(Boolean)
  return problem ? { status: 400, message: problem } : { tags }
}

function parseRequirements(value) {
  if (value === undefined || value === null) return { requirements: { ...DEFAULT_REQUIREMENTS } }
  if (typeof value !== 'object' || Array.isArray(value)) return INVALID
  const requirements = {}
  for (const kind of LINK_KINDS) {
    const level = value[kind] ?? DEFAULT_REQUIREMENTS[kind]
    if (!requirementAllowed(kind, level)) return INVALID
    requirements[kind] = level
  }
  return { requirements }
}

// { startsAt, endsAt } as ISO times, or { status, message }. The start may be a few minutes in the
// past (the form took a while), never further back, and within a year.
function parseDates(body, now) {
  const start = isText(body.startsAt) ? Date.parse(body.startsAt) : Number.NaN
  const end = isText(body.endsAt) ? Date.parse(body.endsAt) : Number.NaN
  if (Number.isNaN(start) || Number.isNaN(end)) return { status: 400, message: 'Pick a start and an end date.' }
  if (start < now - EVENT_LIMITS.startGraceMs) return { status: 400, message: 'Pick a start date from now on.' }
  if (start > now + EVENT_LIMITS.aheadMs) return { status: 400, message: 'Pick a start date within a year.' }
  if (end <= start) return { status: 400, message: 'The end must come after the start.' }
  if (end - start < EVENT_LIMITS.minMs || end - start > EVENT_LIMITS.maxMs) {
    return { status: 400, message: `An event can last from 1 hour to ${EVENT_LIMITS.maxMs / 86_400_000} days.` }
  }
  return { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() }
}

// The whole event from the form, cleaned up: { value } or { status, message }. closesAt (the end
// of voting) follows from the end.
export function parseEvent(body, now = Date.now()) {
  const title = textField(body.title, { max: EVENT_LIMITS.title, what: 'title', empty: 'Give your event a title.' })
  if (title.text === undefined) return title
  const summary = textField(body.summary, { max: EVENT_LIMITS.summary, what: 'summary', empty: 'Add a one-line summary.' })
  if (summary.text === undefined) return summary
  const description = textField(body.description, { max: EVENT_LIMITS.description, what: 'description', multiline: true, empty: 'Describe the event.' })
  if (description.text === undefined) return description
  const rules = textField(body.rules, { max: EVENT_LIMITS.rules, what: 'rules', multiline: true })
  if (rules.text === undefined) return rules
  const prizes = textField(body.prizes, { max: EVENT_LIMITS.prizes, what: 'prizes', multiline: true })
  if (prizes.text === undefined) return prizes
  if (!EVENT_KINDS.includes(body.kind)) return { status: 400, message: 'Pick a kind of event.' }
  const tags = parseTagList(body.tags ?? [])
  if (!tags.tags) return tags
  const dates = parseDates(body, now)
  if (!dates.startsAt) return dates
  const requirements = parseRequirements(body.requirements)
  if (!requirements.requirements) return requirements

  return {
    value: {
      title: title.text,
      summary: summary.text,
      description: description.text,
      rules: rules.text,
      prizes: prizes.text,
      kind: body.kind,
      tags: tags.tags,
      ...dates,
      closesAt: new Date(Date.parse(dates.endsAt) + VOTING_MS).toISOString(),
      requirements: requirements.requirements,
    },
  }
}

// How each link is named in messages ("That repository link won't work.").
const LINK_FIELDS = [
  { kind: 'repo', field: 'repoUrl', label: 'repository' },
  { kind: 'video', field: 'videoUrl', label: 'video' },
  { kind: 'demo', field: 'demoUrl', label: 'demo' },
]

// An entry from the form, checked against what the event asks for: { value } or { status, message }.
// A link the event turned off is dropped.
export function parseEntry(body, requirements) {
  const title = textField(body.title, { max: EVENT_LIMITS.entryTitle, what: 'title', empty: 'Give your entry a title.' })
  if (title.text === undefined) return title
  const description = textField(body.description, { max: EVENT_LIMITS.entryDescription, what: 'description', multiline: true })
  if (description.text === undefined) return description

  const value = { title: title.text, description: description.text }
  for (const { kind, field, label } of LINK_FIELDS) {
    const raw = body[field] ?? ''
    if (!isText(raw)) return INVALID
    const level = requirements[kind]
    const url = raw.trim()
    if (level === 'off' || !url) {
      if (level === 'required') return { status: 400, message: `This event asks for a ${label} link.` }
      value[field] = null
      continue
    }
    const problem = linkProblem(kind, url)
    if (problem) return { status: 400, message: `That ${label} link won't work. ${problem}` }
    value[field] = new URL(url).href
  }
  return { value }
}
