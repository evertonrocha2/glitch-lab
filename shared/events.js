// Community events (hackathons, backend battles, challenges, study groups): rules shared by the API,
// which enforces them, and the pages, which hint at them.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// Max characters per field, how many tags, and the daily limit on new events per person.
export const EVENT_LIMITS = {
  title: 100,
  summary: 200,
  description: 6000,
  rules: 6000,
  prizes: 1000,
  tags: 5,
  entryTitle: 100,
  entryDescription: 2000,
  url: 300,
  eventsPerDay: 3,
  pageSize: 12,
  // An event lasts at least an hour and at most 30 days, and starts within a year.
  minMs: HOUR,
  maxMs: 30 * DAY,
  aheadMs: 365 * DAY,
  // "Start now" still works when the form took a few minutes to fill in.
  startGraceMs: 10 * MINUTE,
}

export const EVENT_KINDS = ['hackathon', 'battle', 'challenge', 'study-group']

// What an entry must link to. The repository can't be turned off: every entry ships code.
export const LINK_KINDS = ['repo', 'video', 'demo']
export const REQUIREMENT_LEVELS = ['required', 'optional', 'off']
export const DEFAULT_REQUIREMENTS = { repo: 'required', video: 'optional', demo: 'optional' }
export const requirementAllowed = (kind, level) => REQUIREMENT_LEVELS.includes(level) && !(kind === 'repo' && level === 'off')

// After the end, people still have this long to vote, unless the organizer announces winners sooner.
export const VOTING_MS = 2 * DAY

export const EVENT_STATUSES = ['upcoming', 'live', 'voting', 'ended']
// The list's tabs: an event in its voting window still shows as happening now.
export const EVENT_TABS = ['live', 'upcoming', 'ended']

// From the dates alone: closesAt is when voting ends (set sooner when winners are announced).
export function eventStatus({ startsAt, endsAt, closesAt }, now = Date.now()) {
  if (now < Date.parse(startsAt)) return 'upcoming'
  if (now < Date.parse(endsAt)) return 'live'
  if (now < Date.parse(closesAt)) return 'voting'
  return 'ended'
}

export const eventTab = (status) => (status === 'voting' ? 'live' : status)
export const canSubmit = (status) => status === 'live'
export const canVote = (status) => status === 'live' || status === 'voting'
export const canPickWinners = (status) => status === 'voting' || status === 'ended'

// The organizer can change the winners for this long after first announcing them, then the podium is final.
export const WINNERS_EDIT_MS = 2 * DAY
export const winnersLocked = ({ announcedAt }, now = Date.now()) => Boolean(announcedAt) && now >= Date.parse(announcedAt) + WINNERS_EDIT_MS

// { days, hours, minutes, seconds } left, never below zero.
export function timeLeft(ms) {
  const left = Math.max(0, Math.floor(ms / 1000))
  return { days: Math.floor(left / 86_400), hours: Math.floor((left % 86_400) / 3600), minutes: Math.floor((left % 3600) / 60), seconds: left % 60 }
}

const REPO_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org', 'codeberg.org']
const VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'vimeo.com', 'loom.com']
const bareHost = (hostname) => hostname.replace(/^(www|m)\./, '')

// A message saying what's wrong with one entry link, or null when it's fine.
export function linkProblem(kind, value) {
  if (value.length > EVENT_LIMITS.url) return `Use a shorter link (up to ${EVENT_LIMITS.url} characters).`
  let url = null
  try {
    url = new URL(value)
  } catch {
    // Not a URL at all: same message as a wrong one.
  }
  // https only (so never javascript: or data:), a dotted host, and no name or password inside it.
  if (!url || url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password) return 'Use a full https:// link.'
  const host = bareHost(url.hostname)
  if (kind === 'repo') {
    if (!REPO_HOSTS.includes(host)) return 'Use a GitHub, GitLab, Bitbucket or Codeberg link for the code.'
    // owner/project at least, not just a profile.
    if (url.pathname.split('/').filter(Boolean).length < 2) return 'Link to the repository itself, not a profile.'
  }
  if (kind === 'video' && !VIDEO_HOSTS.includes(host)) return 'Use a YouTube, Vimeo or Loom link for the video.'
  return null
}

const VIDEO_ID = /^[\w-]{11}$/

// The id of a YouTube video, for the privacy-friendly embed. null for anything else.
export function youtubeId(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  const host = bareHost(url.hostname)
  const parts = url.pathname.split('/').filter(Boolean)
  let id = null
  if (host === 'youtu.be') id = parts[0]
  else if (host === 'youtube.com') id = parts[0] === 'watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : null
  return id && VIDEO_ID.test(id) ? id : null
}

// Most votes first, the earliest entry first on a tie. Entries with the same votes share a rank.
export function rankEntries(entries) {
  const sorted = [...entries].sort((a, b) => b.votes - a.votes || Date.parse(a.createdAt) - Date.parse(b.createdAt))
  return sorted.map((entry) => ({ ...entry, rank: sorted.findIndex((other) => other.votes === entry.votes) + 1 }))
}

// What taking part is worth, and how many of each count at most (so nobody farms XP).
// hosted: real events you organized (see isRealEvent). Podium places count only from real events,
// and at most podiumsPerWeek of them in each week (by when the event ended), best places first.
export const EVENT_XP = { entry: 30, first: 120, second: 80, third: 50, voteReceived: 2, hosted: 40 }
export const EVENT_XP_CAPS = { entries: 20, votes: 50, hosted: 10, podiumsPerWeek: 2 }
export const HOST_MIN_ENTRIES = 3
export const NO_EVENTS = { entries: 0, first: 0, second: 0, third: 0, votesReceived: 0, hosted: 0, days: [] }

// Accounts the app makes itself (demo visitors, sample authors): same domains as api/_lib/accounts.js.
const MADE_UP = /@(demo|sample)\.glitch$/i
export const isSampleAccount = ({ email, isDemo }) => Boolean(isDemo) || MADE_UP.test(email ?? '')

// A real event lasted at least an hour and got entries from HOST_MIN_ENTRIES different people, not
// counting the organizer or sample accounts. Only real events pay podium and hosting XP.
// entrants: [{ userId, sample }] for this event's entries.
export function isRealEvent(event, entrants) {
  if (Date.parse(event.endsAt) - Date.parse(event.startsAt) < EVENT_LIMITS.minMs) return false
  const people = new Set(entrants.filter((item) => !item.sample && item.userId !== event.organizerId).map((item) => item.userId))
  return people.size >= HOST_MIN_ENTRIES
}

// Weeks start on Monday (UTC). 1970-01-01 was a Thursday, hence the 3 days.
const weekOf = (iso) => Math.floor((Date.parse(iso) + 3 * DAY) / (7 * DAY))

// What both stores answer for eventStats, worked out from the same rows:
// mine: the person's entries [{ eventId, place, createdAt }], oldest first.
// events: [{ id, organizerId, startsAt, endsAt }] for every event a place in `mine` came from, and
//   every event the person organized that might count as hosted.
// entrants: [{ eventId, userId, sample }] for the entries of those events.
export function summarizeEventStats({ userId, mine, events, entrants, votesReceived }) {
  const real = new Map(events.filter((event) => isRealEvent(event, entrants.filter((item) => item.eventId === event.id))).map((event) => [event.id, event]))
  // Best places first, so a capped week keeps its golds.
  const placed = mine.filter((item) => item.place && real.has(item.eventId)).sort((a, b) => a.place - b.place)
  const perWeek = {}
  const places = { 1: 0, 2: 0, 3: 0 }
  for (const item of placed) {
    const week = weekOf(real.get(item.eventId).endsAt)
    perWeek[week] = (perWeek[week] ?? 0) + 1
    if (perWeek[week] <= EVENT_XP_CAPS.podiumsPerWeek) places[item.place] += 1
  }
  return {
    entries: mine.length,
    first: places[1],
    second: places[2],
    third: places[3],
    votesReceived,
    hosted: [...real.values()].filter((event) => event.organizerId === userId).length,
    days: mine.map((item) => new Date(item.createdAt).toISOString().slice(0, 10)),
  }
}

export const eventsXp = ({ entries, first, second, third, votesReceived, hosted }) =>
  Math.min(entries, EVENT_XP_CAPS.entries) * EVENT_XP.entry +
  first * EVENT_XP.first +
  second * EVENT_XP.second +
  third * EVENT_XP.third +
  Math.min(votesReceived, EVENT_XP_CAPS.votes) * EVENT_XP.voteReceived +
  Math.min(hosted, EVENT_XP_CAPS.hosted) * EVENT_XP.hosted
