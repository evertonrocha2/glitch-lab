import { ADA, BO } from './community.js'

// Community events shaped like /api/community returns them, for UI tests.
const HOUR = 3_600_000
const DAY = 24 * HOUR
export const CY = { handle: null, name: 'Cy', avatar: { seed: 'cy', color: 'cobalt' }, isPublic: false }

export function makeEventSummary(overrides = {}) {
  const now = Date.now()
  return {
    id: 'e1',
    title: 'Rinha de Backend',
    summary: 'Build the fastest payments API you can.',
    kind: 'battle',
    tags: ['backend', 'go'],
    startsAt: new Date(now - DAY).toISOString(),
    endsAt: new Date(now + 2 * DAY + 3 * HOUR).toISOString(),
    closesAt: new Date(now + 4 * DAY + 3 * HOUR).toISOString(),
    status: 'live',
    organizer: ADA,
    entryCount: 2,
    announced: false,
    ...overrides,
  }
}

export function makeEvent(overrides = {}) {
  return {
    ...makeEventSummary(),
    description: 'Two endpoints, one database.\n\n<img src=x onerror=alert(1)>',
    rules: 'One entry each.',
    prizes: 'A gold pixel medal.',
    requirements: { repo: 'required', video: 'optional', demo: 'off' },
    mine: false,
    createdAt: new Date(Date.now() - 2 * DAY).toISOString(),
    updatedAt: new Date(Date.now() - 2 * DAY).toISOString(),
    ...overrides,
  }
}

export function makeEntry(overrides = {}) {
  return {
    id: 'x1',
    title: 'Queue first',
    description: 'A queue in front of Postgres.',
    repoUrl: 'https://github.com/bo/rinha',
    videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
    demoUrl: null,
    votes: 3,
    place: null,
    rank: 1,
    author: BO,
    mine: false,
    createdAt: new Date(Date.now() - HOUR).toISOString(),
    updatedAt: new Date(Date.now() - HOUR).toISOString(),
    ...overrides,
  }
}

export const loadedEvent = (overrides = {}) => ({
  event: makeEvent(),
  entries: [makeEntry(), makeEntry({ id: 'x2', title: 'Cache it', votes: 1, rank: 2, author: CY, videoUrl: null, repoUrl: 'https://gitlab.com/cy/rinha' })],
  myEntry: null,
  myVotes: [],
  ...overrides,
})
