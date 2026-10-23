import { eventStatus } from '../../../shared/events.js'

// What the pages get: people as name, handle and avatar (never an id), and the status worked out
// from the dates at `now`.

export function eventSummary(event, people, now = Date.now()) {
  return {
    id: event.id,
    title: event.title,
    summary: event.summary,
    kind: event.kind,
    tags: event.tags,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    closesAt: event.closesAt,
    status: eventStatus(event, now),
    organizer: people[event.organizerId],
    entryCount: event.entryCount,
    announced: Boolean(event.announcedAt),
  }
}

export function eventView(event, people, viewerId, now = Date.now()) {
  return {
    ...eventSummary(event, people, now),
    description: event.description,
    rules: event.rules,
    prizes: event.prizes,
    requirements: event.requirements,
    mine: Boolean(viewerId) && viewerId === event.organizerId,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  }
}

export function entryView(entry, people, viewerId) {
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    repoUrl: entry.repoUrl,
    videoUrl: entry.videoUrl,
    demoUrl: entry.demoUrl,
    votes: entry.votes,
    place: entry.place,
    author: people[entry.userId],
    mine: Boolean(viewerId) && viewerId === entry.userId,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}
