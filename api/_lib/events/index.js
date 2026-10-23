import * as entries from './entries.js'
import * as events from './events.js'
import * as votes from './votes.js'

// The ?resource= names /api/community answers for events (sharing that function keeps the app
// under Vercel's 12-function limit).
export const EVENT_RESOURCES = { events, 'event-entries': entries, 'event-votes': votes }
