import * as entries from './entries.service.js'
import * as events from './events.service.js'
import * as votes from './votes.service.js'

// The ?resource= names /api/community answers for events (sharing that function keeps the app
// under Vercel's 12-function limit).
export const EVENT_RESOURCES = { events, 'event-entries': entries, 'event-votes': votes }
