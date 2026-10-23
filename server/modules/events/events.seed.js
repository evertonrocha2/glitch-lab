import { VOTING_MS } from '../../../shared/events.js'

// A sample live event by the sample team, so the events area is never empty for a judge trying the
// demo. A new one starts whenever the last one is over. Each language has its own copy, like the
// articles: a Portuguese visitor gets a live event written in Portuguese.
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
    'One entry per person. You can edit it while the event is live, until it gets its first vote.',
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

const EVENT_PT = {
  ...EVENT,
  title: 'Rinha de Backend: edição Glitch',
  summary: 'Construa uma API de pagamentos pequena que aguente um teste de carga. Compartilhe o repositório e um vídeo curto.',
  description: [
    'Uma "rinha" é uma briga amigável: todo mundo constrói o mesmo backend pequeno e depois a gente compara.',
    'Construa uma API com dois endpoints: POST /payments guarda um pagamento, GET /payments-summary soma todos. Qualquer linguagem, qualquer banco de dados.',
    'Publique sua participação com o link do repositório e, se puder, um vídeo curto. Vote nas participações de que você mais gostar.',
  ].join('\n\n'),
  rules: [
    'Uma participação por pessoa. Você pode editar a sua enquanto o evento estiver no ar, até ela receber o primeiro voto.',
    'O repositório precisa ser público, com um README que diga como rodar o projeto.',
    'Seja gentil nos votos: vote no que você gostaria de aprender.',
  ].join('\n\n'),
  prizes: 'Uma medalha pixel de ouro, prata ou bronze na página do evento, e XP para o pódio.',
}

const ENTRIES_PT = {
  reader: {
    title: 'Fila primeiro, depois Postgres',
    description:
      'Participação de exemplo. Os pagamentos entram numa fila em memória e um worker grava em lotes, então a API responde rápido sob carga. O link abre o repositório oficial da Rinha de Backend 2025.',
  },
  ana: {
    title: 'Um arquivo, zero dependências',
    description:
      'Participação de exemplo. Um único arquivo Node.js com o módulo http nativo e SQLite, pequeno o bastante para ler em cinco minutos. O link abre um repositório oficial anterior da Rinha de Backend.',
  },
}

// The event and its entries in the visitor's language.
const COPY = {
  en: { event: EVENT, entries: ENTRIES },
  'pt-BR': { event: EVENT_PT, entries: ENTRIES.map((entry) => ({ ...entry, ...ENTRIES_PT[entry.who] })) },
}

// Votes as [voter, entry author]: nobody votes for their own entry.
const VOTES = [
  ['ana', 'reader'],
  ['team', 'reader'],
  ['reader', 'ana'],
]

// people: { team, reader } from the community seed; samplePerson makes Ana the same way.
// locale: the visitor's language. Only a live sample in that language counts as already there.
export async function seedEvents(store, { team, reader }, samplePerson, now = Date.now(), locale = 'en') {
  const copy = COPY[locale] ?? COPY.en
  const at = new Date(now).toISOString()
  const { events } = await store.listEvents({ tab: 'live', now: at, organizerId: team.id, offset: 0, limit: 20 })
  if (events.some((item) => item.title === copy.event.title)) return
  const ana = await samplePerson(store, ANA)
  if (!ana) return
  const people = { team, reader, ana }

  const event = await store.createEvent(team.id, {
    ...copy.event,
    startsAt: new Date(now - DAY).toISOString(),
    endsAt: new Date(now + 4 * DAY).toISOString(),
    closesAt: new Date(now + 4 * DAY + VOTING_MS).toISOString(),
  })
  const byAuthor = {}
  for (const { who, ...fields } of copy.entries) byAuthor[who] = await store.createEntry(event.id, people[who].id, fields)
  for (const [voter, author] of VOTES) await store.setVote(byAuthor[author].id, people[voter].id, true)
}
