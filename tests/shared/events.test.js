// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  canPickWinners,
  canSubmit,
  canVote,
  EVENT_XP,
  EVENT_XP_CAPS,
  eventStatus,
  eventsXp,
  eventTab,
  isRealEvent,
  isSampleAccount,
  linkProblem,
  NO_EVENTS,
  rankEntries,
  summarizeEventStats,
  timeLeft,
  VOTING_MS,
  youtubeId,
} from '../../shared/events.js'

const HOUR = 3_600_000
const NOW = Date.parse('2026-10-22T12:00:00Z')
const at = (offset) => new Date(NOW + offset).toISOString()
const event = (start, end, closes = end + VOTING_MS) => ({ startsAt: at(start), endsAt: at(end), closesAt: at(closes) })

describe('status from dates', () => {
  it('is upcoming, live, voting, then ended', () => {
    const item = event(HOUR, 3 * HOUR)
    expect(eventStatus(item, NOW)).toBe('upcoming')
    expect(eventStatus(item, NOW + HOUR)).toBe('live')
    expect(eventStatus(item, NOW + 3 * HOUR)).toBe('voting')
    expect(eventStatus(item, NOW + 3 * HOUR + VOTING_MS)).toBe('ended')
  })

  it('ends right away once the voting window is closed early', () => {
    const item = event(-3 * HOUR, -HOUR, -1)
    expect(eventStatus(item, NOW)).toBe('ended')
  })

  it('groups statuses into the list tabs and says what each one allows', () => {
    expect(['upcoming', 'live', 'voting', 'ended'].map(eventTab)).toEqual(['upcoming', 'live', 'live', 'ended'])
    expect(['upcoming', 'live', 'voting', 'ended'].map(canSubmit)).toEqual([false, true, false, false])
    expect(['upcoming', 'live', 'voting', 'ended'].map(canVote)).toEqual([false, true, true, false])
    expect(['upcoming', 'live', 'voting', 'ended'].map(canPickWinners)).toEqual([false, false, true, true])
  })

  it('splits the time left for a countdown', () => {
    expect(timeLeft(2 * 86_400_000 + 3 * HOUR + 4 * 60_000 + 5_000)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 })
    expect(timeLeft(-5)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  })
})

describe('entry links', () => {
  it('takes repositories only from the known code hosts', () => {
    for (const url of ['https://github.com/ada/rinha', 'https://gitlab.com/ada/rinha', 'https://bitbucket.org/ada/rinha', 'https://codeberg.org/ada/rinha', 'https://www.github.com/ada/rinha']) {
      expect(linkProblem('repo', url)).toBeNull()
    }
    expect(linkProblem('repo', 'https://github.com/ada')).toMatch(/repository/)
    expect(linkProblem('repo', 'https://evil.com/ada/rinha')).toMatch(/GitHub/)
    expect(linkProblem('repo', 'https://github.com.evil.com/ada/rinha')).toMatch(/GitHub/)
    expect(linkProblem('repo', 'http://github.com/ada/rinha')).toMatch(/https/)
  })

  it('takes videos only from YouTube, Vimeo or Loom', () => {
    for (const url of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'https://vimeo.com/123', 'https://www.loom.com/share/abc', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ']) {
      expect(linkProblem('video', url)).toBeNull()
    }
    expect(linkProblem('video', 'https://tiktok.com/@ada/video/1')).toMatch(/YouTube/)
  })

  it('takes any https demo, never script or data links', () => {
    expect(linkProblem('demo', 'https://rinha.ada.dev/')).toBeNull()
    for (const url of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'http://rinha.ada.dev', 'ftp://ada.dev', 'not a link', 'https://user:pass@ada.dev']) {
      expect(linkProblem('demo', url)).toMatch(/https/)
    }
    expect(linkProblem('demo', `https://ada.dev/${'a'.repeat(400)}`)).toMatch(/shorter/)
  })

  it('finds the YouTube video id for the embed, and nothing for other links', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://www.youtube.com/watch?v=bad"id')).toBeNull()
    expect(youtubeId('https://vimeo.com/123')).toBeNull()
    expect(youtubeId(null)).toBeNull()
  })
})

describe('ranking', () => {
  it('orders by votes, earliest first on a tie, and shares the rank on a tie', () => {
    const entries = [
      { id: 'late', votes: 3, createdAt: '2026-10-22T10:00:00Z' },
      { id: 'top', votes: 5, createdAt: '2026-10-22T11:00:00Z' },
      { id: 'early', votes: 3, createdAt: '2026-10-22T09:00:00Z' },
      { id: 'none', votes: 0, createdAt: '2026-10-22T08:00:00Z' },
    ]
    expect(rankEntries(entries).map((item) => [item.id, item.rank])).toEqual([
      ['top', 1],
      ['early', 2],
      ['late', 2],
      ['none', 4],
    ])
  })
})

describe('xp', () => {
  it('pays for taking part, placing, votes and hosting, with caps', () => {
    expect(eventsXp(NO_EVENTS)).toBe(0)
    const stats = { entries: 2, first: 1, second: 1, third: 1, votesReceived: 4, hosted: 1, days: [] }
    expect(eventsXp(stats)).toBe(2 * 30 + 120 + 80 + 50 + 4 * 2 + 40)
    expect(EVENT_XP).toMatchObject({ entry: 30, first: 120, second: 80, third: 50, voteReceived: 2, hosted: 40 })
    const farmed = { ...NO_EVENTS, entries: 999, votesReceived: 999, hosted: 999 }
    expect(eventsXp(farmed)).toBe(
      EVENT_XP_CAPS.entries * EVENT_XP.entry + EVENT_XP_CAPS.votes * EVENT_XP.voteReceived + EVENT_XP_CAPS.hosted * EVENT_XP.hosted,
    )
  })
})

describe('real events and podium caps', () => {
  const real = (overrides = {}) => ({ id: 'e1', organizerId: 'org', ...event(-3 * HOUR, -HOUR), ...overrides })
  const people = (eventId, ...ids) => ids.map((userId) => ({ eventId, userId, sample: false }))

  it('tells sample and demo accounts apart from real ones', () => {
    expect(isSampleAccount({ email: 'ana@sample.glitch', isDemo: false })).toBe(true)
    expect(isSampleAccount({ email: 'demo-1@demo.glitch', isDemo: true })).toBe(true)
    expect(isSampleAccount({ email: 'x@example.com', isDemo: true })).toBe(true)
    expect(isSampleAccount({ email: 'ada@example.com', isDemo: false })).toBe(false)
    expect(isSampleAccount({})).toBe(false)
  })

  it('needs three different real people besides the organizer, and an hour', () => {
    expect(isRealEvent(real(), people('e1', 'a', 'b', 'c'))).toBe(true)
    expect(isRealEvent(real(), people('e1', 'a', 'b'))).toBe(false)
    expect(isRealEvent(real(), [...people('e1', 'a', 'b'), { userId: 'c', sample: true }])).toBe(false)
    expect(isRealEvent(real(), people('e1', 'a', 'b', 'org'))).toBe(false)
    expect(isRealEvent(real(), people('e1', 'a', 'a', 'b'))).toBe(false)
    expect(isRealEvent(real(event(-HOUR, -HOUR / 2)), people('e1', 'a', 'b', 'c'))).toBe(false)
  })

  it('counts places from real events only, at most two a week, best first', () => {
    const week = (days) => ({ ...event(days * 24 * HOUR - HOUR, days * 24 * HOUR) })
    const events = [
      { id: 'w1', organizerId: 'org', ...week(0) },
      { id: 'w2', organizerId: 'org', ...week(0) },
      { id: 'w3', organizerId: 'org', ...week(0) },
      { id: 'next', organizerId: 'org', ...week(7) },
      { id: 'fake', organizerId: 'org', ...week(14) },
      { id: 'mine', organizerId: 'me', ...week(14) },
    ]
    // 'fake' has only me in it; 'mine' is the one I organized.
    const entrants = [...['w1', 'w2', 'w3', 'next'].flatMap((id) => people(id, 'me', 'a', 'b')), ...people('fake', 'me'), ...people('mine', 'a', 'b', 'c')]
    const mine = [
      { eventId: 'w1', place: 3, createdAt: at(0) },
      { eventId: 'w2', place: 2, createdAt: at(0) },
      { eventId: 'w3', place: 1, createdAt: at(0) },
      { eventId: 'next', place: 3, createdAt: at(7 * 24 * HOUR) },
      { eventId: 'fake', place: 1, createdAt: at(14 * 24 * HOUR) },
    ]
    const stats = summarizeEventStats({ userId: 'me', mine, events, entrants, votesReceived: 4 })
    expect(stats).toEqual({ entries: 5, first: 1, second: 1, third: 1, votesReceived: 4, hosted: 1, days: mine.map((item) => item.createdAt.slice(0, 10)) })
    expect(EVENT_XP_CAPS.podiumsPerWeek).toBe(2)
  })
})
