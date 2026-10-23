import { cleanQuery } from '../../../shared/community.js'
import { HOST_MIN_ENTRIES, isSampleAccount, summarizeEventStats } from '../../../shared/events.js'

// Postgres "invalid input syntax for type uuid": a malformed id simply matches nothing.
const INVALID_UUID = '22P02'
// Postgres "unique violation": the person already has an entry in this event.
const UNIQUE = '23505'

const toEvent = (row) =>
  row && {
    id: row.id,
    organizerId: row.organizer_id,
    title: row.title,
    summary: row.summary,
    description: row.description,
    rules: row.rules,
    prizes: row.prizes,
    kind: row.kind,
    tags: row.tags ?? [],
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    closesAt: new Date(row.closes_at).toISOString(),
    requirements: row.requirements,
    announcedAt: row.announced_at ? new Date(row.announced_at).toISOString() : null,
    entryCount: row.entry_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

const toEntry = (row) =>
  row && {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    repoUrl: row.repo_url,
    videoUrl: row.video_url,
    demoUrl: row.demo_url,
    votes: row.vote_count,
    place: row.place,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

// What isRealEvent reads from an event row.
const EVENT_RULE_COLUMNS = 'id, organizer_id, starts_at, ends_at'

const defined = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined))

const eventColumns = ({ title, summary, description, rules, prizes, kind, tags, startsAt, endsAt, closesAt, requirements, announcedAt }) =>
  defined({
    title,
    summary,
    description,
    rules,
    prizes,
    kind,
    tags,
    starts_at: startsAt,
    ends_at: endsAt,
    closes_at: closesAt,
    requirements,
    announced_at: announcedAt,
  })

const entryColumns = ({ title, description, repoUrl, videoUrl, demoUrl }) =>
  defined({ title, description, repo_url: repoUrl, video_url: videoUrl, demo_url: demoUrl })

function unwrap({ data, error }) {
  if (error?.code === INVALID_UUID) return null
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

function counted({ count, error }) {
  if (error?.code === INVALID_UUID) return 0
  if (error) throw new Error(`Supabase: ${error.message}`)
  return count ?? 0
}

// Live (and voting) events end soonest first, upcoming ones start soonest first, ended ones newest first.
const TABS = {
  live: (query, at) => query.lte('starts_at', at).gt('closes_at', at).order('ends_at', { ascending: true }),
  upcoming: (query, at) => query.gt('starts_at', at).order('starts_at', { ascending: true }),
  ended: (query, at) => query.lte('closes_at', at).order('closes_at', { ascending: false }),
}

// Community events, their entries and votes on Supabase. Spread into createSupabaseStore.
export function createSupabaseEvents(db) {
  // Counts live on the rows; SQL functions recount them after every change.
  const recountEntries = async (eventId) => unwrap(await db.rpc('refresh_event_entry_count', { p_event: eventId }))
  const recountVotes = async (entryId) => unwrap(await db.rpc('refresh_entry_vote_count', { p_entry: entryId }))
  const getEntry = async (id) => toEntry(unwrap(await db.from('event_entries').select('*').eq('id', id).maybeSingle()))
  const count = (table) => db.from(table).select('*', { count: 'exact', head: true })

  return {
    async createEvent(organizerId, fields) {
      return toEvent(unwrap(await db.from('events').insert({ organizer_id: organizerId, ...eventColumns(fields) }).select().single()))
    },

    async getEvent(id) {
      return toEvent(unwrap(await db.from('events').select('*').eq('id', id).maybeSingle()))
    },

    async updateEvent(organizerId, id, patch) {
      const columns = { ...eventColumns(patch), updated_at: new Date().toISOString() }
      return toEvent(unwrap(await db.from('events').update(columns).eq('id', id).eq('organizer_id', organizerId).select().maybeSingle()))
    },

    // q is cleaned down to letters, numbers and a few symbols, then quoted, so it can't change the filter.
    async listEvents({ q = '', tab = null, now = new Date().toISOString(), organizerId = null, offset = 0, limit = 12 }) {
      let query = db.from('events').select('*')
      if (organizerId) query = query.eq('organizer_id', organizerId)
      const needle = cleanQuery(q)
      if (needle) {
        const pattern = `"%${needle}%"`
        query = query.or([`title.ilike.${pattern}`, `summary.ilike.${pattern}`, `tags.cs.{"${needle.toLowerCase()}"}`].join(','))
      }
      query = TABS[tab] ? TABS[tab](query, now).order('created_at', { ascending: true }) : query.order('created_at', { ascending: false })
      // One extra row says whether there is another page.
      const rows = unwrap(await query.range(offset, offset + limit)) ?? []
      return { events: rows.slice(0, limit).map(toEvent), hasMore: rows.length > limit }
    },

    async createEntry(eventId, userId, fields) {
      const { data, error } = await db
        .from('event_entries')
        .insert({ event_id: eventId, user_id: userId, ...entryColumns(fields) })
        .select()
        .single()
      if (error?.code === UNIQUE) return null
      const row = unwrap({ data, error })
      await recountEntries(eventId)
      return toEntry(row)
    },

    getEntry,

    async findEntry(eventId, userId) {
      return toEntry(unwrap(await db.from('event_entries').select('*').eq('event_id', eventId).eq('user_id', userId).maybeSingle()))
    },

    async listEntries(eventId) {
      const rows = unwrap(await db.from('event_entries').select('*').eq('event_id', eventId).order('created_at', { ascending: true }))
      return (rows ?? []).map(toEntry)
    },

    async updateEntry(userId, id, patch) {
      const columns = { ...entryColumns(patch), updated_at: new Date().toISOString() }
      return toEntry(unwrap(await db.from('event_entries').update(columns).eq('id', id).eq('user_id', userId).select().maybeSingle()))
    },

    async setPlaces(eventId, places) {
      unwrap(await db.from('event_entries').update({ place: null }).eq('event_id', eventId).not('place', 'is', null))
      for (const [entryId, place] of Object.entries(places)) {
        unwrap(await db.from('event_entries').update({ place }).eq('id', entryId).eq('event_id', eventId))
      }
    },

    async getVotes(eventId, userId) {
      const rows = unwrap(await db.from('event_votes').select('entry_id').eq('event_id', eventId).eq('user_id', userId))
      return (rows ?? []).map((row) => row.entry_id)
    },

    async setVote(entryId, userId, voted) {
      const entry = await getEntry(entryId)
      if (!entry) return null
      if (voted) {
        // The event and the entry's author are copied onto the vote, so "votes I received" is one count.
        const row = { entry_id: entryId, user_id: userId, event_id: entry.eventId, author_id: entry.userId }
        unwrap(await db.from('event_votes').upsert(row, { onConflict: 'entry_id,user_id', ignoreDuplicates: true }))
      } else {
        unwrap(await db.from('event_votes').delete().eq('entry_id', entryId).eq('user_id', userId))
      }
      await recountVotes(entryId)
      return { voted: Boolean(voted), votes: (await getEntry(entryId)).votes }
    },

    // The rows summarizeEventStats needs: my entries, the events I hosted and the ones my places came
    // from, and who entered those events (with their accounts, to leave sample ones out).
    async eventStats(userId) {
      const [entries, votesReceived, hostedRows] = await Promise.all([
        db.from('event_entries').select('event_id, place, created_at').eq('user_id', userId).order('created_at', { ascending: true }),
        count('event_votes').eq('author_id', userId),
        db.from('events').select(EVENT_RULE_COLUMNS).eq('organizer_id', userId).gte('entry_count', HOST_MIN_ENTRIES),
      ])
      const mine = (unwrap(entries) ?? []).map((row) => ({ eventId: row.event_id, place: row.place, createdAt: row.created_at }))
      const hosted = unwrap(hostedRows) ?? []
      const placedIds = [...new Set(mine.filter((item) => item.place).map((item) => item.eventId))].filter((id) => !hosted.some((row) => row.id === id))
      const placedRows = placedIds.length ? (unwrap(await db.from('events').select(EVENT_RULE_COLUMNS).in('id', placedIds)) ?? []) : []
      const events = [...hosted, ...placedRows].map((row) => ({
        id: row.id,
        organizerId: row.organizer_id,
        startsAt: new Date(row.starts_at).toISOString(),
        endsAt: new Date(row.ends_at).toISOString(),
      }))
      const ids = events.map((event) => event.id)
      const entrantRows = ids.length ? (unwrap(await db.from('event_entries').select('event_id, user_id, users!inner(email, is_demo)').in('event_id', ids)) ?? []) : []
      const entrants = entrantRows.map((row) => ({
        eventId: row.event_id,
        userId: row.user_id,
        sample: isSampleAccount({ email: row.users?.email, isDemo: row.users?.is_demo }),
      }))
      return summarizeEventStats({ userId, mine, events, entrants, votesReceived: counted(votesReceived) })
    },
  }
}
