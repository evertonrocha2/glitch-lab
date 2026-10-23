// @vitest-environment node
import { expect, it } from 'vitest'
import { parseEntry, parseEvent } from '../../api/_lib/events/parse.js'
import { translateServerMessage } from './i18n/serverMessages.js'

const pt = (message) => translateServerMessage(message, 'pt-BR')
const DAY = 86_400_000
const NOW = Date.parse('2026-10-22T12:00:00Z')
const iso = (offset) => new Date(NOW + offset).toISOString()
const event = (overrides) => ({ title: 'Rinha', summary: 'Fast APIs.', description: 'Go.', kind: 'battle', startsAt: iso(0), endsAt: iso(DAY), ...overrides })
const ALL_REQUIRED = { repo: 'required', video: 'required', demo: 'required' }
const entry = (overrides) => ({ title: 'Mine', repoUrl: 'https://github.com/a/b', videoUrl: 'https://youtu.be/dQw4w9WgXcQ', demoUrl: 'https://a.dev', ...overrides })

it('knows the event messages built from limits and checks', () => {
  const messages = [
    parseEvent(event({ title: 'x'.repeat(500) }), NOW).message,
    parseEvent(event({ summary: 'x'.repeat(500) }), NOW).message,
    parseEvent(event({ description: 'x'.repeat(7000) }), NOW).message,
    parseEvent(event({ rules: 'x'.repeat(7000) }), NOW).message,
    parseEvent(event({ prizes: 'x'.repeat(2000) }), NOW).message,
    parseEvent(event({ endsAt: iso(40 * DAY) }), NOW).message,
    parseEvent(event({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] }), NOW).message,
    parseEntry(entry({ description: 'x'.repeat(3000) }), ALL_REQUIRED).message,
    parseEntry(entry({ repoUrl: '' }), ALL_REQUIRED).message,
    parseEntry(entry({ videoUrl: '' }), ALL_REQUIRED).message,
    parseEntry(entry({ demoUrl: '' }), ALL_REQUIRED).message,
    parseEntry(entry({ repoUrl: 'https://evil.com/a/b' }), ALL_REQUIRED).message,
    parseEntry(entry({ repoUrl: 'https://github.com/a' }), ALL_REQUIRED).message,
    parseEntry(entry({ videoUrl: 'https://evil.com/v' }), ALL_REQUIRED).message,
    parseEntry(entry({ demoUrl: 'javascript:alert(1)' }), ALL_REQUIRED).message,
    parseEntry(entry({ demoUrl: `https://a.dev/${'x'.repeat(400)}` }), ALL_REQUIRED).message,
  ]
  for (const message of messages) {
    expect(typeof message).toBe('string')
    expect(pt(message), message).not.toBe(message)
  }
})

it('reads naturally in Portuguese', () => {
  expect(pt('Too long. Keep your title under 101 characters.')).toBe('Muito longo. Deixe o título com menos de 101 caracteres.')
  expect(pt('This event asks for a repository link.')).toBe('Este evento pede o link do repositório.')
  expect(pt("That video link won't work. Use a YouTube, Vimeo or Loom link for the video.")).toBe(
    'Esse link do vídeo não serve. Use um link do YouTube, Vimeo ou Loom para o vídeo.',
  )
  expect(pt('You can create 3 events a day. Come back tomorrow.')).toBe('Você pode criar 3 eventos por dia. Volte amanhã.')
})
