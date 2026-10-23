import { VOTING_MS } from '../../../shared/events.js'

// A sample live event by the sample team, so the events area is never empty for a judge trying the
// demo. A new one starts whenever the last one is over. The copy stays English, like the articles.
const HOUR = 3_600_000
const DAY = 24 * HOUR

const ANA = {
  email: 'ana@sample.glitch',
  profile: { handle: 'ana_codes', displayName: 'Ana', bio: 'Backend at night, tests by day.', avatar: { seed: 'ana-codes', color: 'violet' }, isPublic: false },
}

const EVENT = {
  title: 'Rinha de Backend: Glitch Edition',
  summary: 'Build a tiny payments API that survives a load test. Share the repo and a short video.',
  description: [
    'A "rinha" is a friendly fight: everyone builds the same small backend, then we compare.',
    'Build an API with two endpoints: POST /payments stores a payment, GET /payments-summary adds them up. Any language, any database.',
    'Post your entry with the repository link, and a short video if you can. Vote for the entries you like best.',
  ].join('\n\n'),
  rules: [
    'One entry per person. You can edit it while the event is live.',
    'The repository must be public, with a README that says how to run it.',
    'Be kind in the votes: vote for what you would like to learn from.',
  ].join('\n\n'),
  prizes: 'A gold, silver or bronze pixel medal on the event page, and XP for the podium.',
  kind: 'battle',
  tags: ['backend', 'api', 'rinha'],
  requirements: { repo: 'required', video: 'optional', demo: 'optional' },
}

const ENTRIES = [
  {
    who: 'reader',
    title: 'Queue first, then Postgres',
    description:
      'Sample entry. Payments go into an in-memory queue and a worker writes them in batches, so the API answers fast under load. The link opens the official Rinha de Backend 2025 repository.',
    repoUrl: 'https://github.com/zanfranceschi/rinha-de-backend-2025',
    videoUrl: null,
    demoUrl: null,
  },
  {
    who: 'ana',
    title: 'One file, zero dependencies',
    description:
      'Sample entry. A single Node.js file with the built-in http module and SQLite, small enough to read in five minutes. The link opens an earlier official Rinha de Backend repository.',
    repoUrl: 'https://github.com/zanfranceschi/rinha-de-backend-2024-q1',
    videoUrl: null,
    demoUrl: null,
  },
]

// Votes as [voter, entry author]: nobody votes for their own entry.
const VOTES = [
  ['ana', 'reader'],
  ['team', 'reader'],
  ['reader', 'ana'],
]

// people: { team, reader } from the community seed; samplePerson makes Ana the same way.
export async function seedEvents(store, { team, reader }, samplePerson, now = Date.now()) {
  const at = new Date(now).toISOString()
  const { events } = await store.listEvents({ tab: 'live', now: at, organizerId: team.id, offset: 0, limit: 1 })
  if (events.length) return
  const ana = await samplePerson(store, ANA)
  if (!ana) return
  const people = { team, reader, ana }

  const event = await store.createEvent(team.id, {
    ...EVENT,
    startsAt: new Date(now - DAY).toISOString(),
    endsAt: new Date(now + 4 * DAY).toISOString(),
    closesAt: new Date(now + 4 * DAY + VOTING_MS).toISOString(),
  })
  const byAuthor = {}
  for (const { who, ...fields } of ENTRIES) byAuthor[who] = await store.createEntry(event.id, people[who].id, fields)
  for (const [voter, author] of VOTES) await store.setVote(byAuthor[author].id, people[voter].id, true)
}
