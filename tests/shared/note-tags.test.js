// @vitest-environment node
import { expect, it } from 'vitest'
import { hasAllTags, NOTE_TAG_CHARS, NOTE_TAG_LIMITS, normalizeTag, noteTagProblem, parseNoteTags, tagCounts } from '../../shared/note-tags.js'

it('trims, collapses spaces and lowercases, but keeps accents', () => {
  expect(normalizeTag('  JavaScript  ')).toBe('javascript')
  expect(normalizeTag('Laço   de\trepetição')).toBe('laço de repetição')
  expect(normalizeTag('LAÇO')).toBe('laço')
  // A decomposed "ç" (c + combining cedilla) is the same tag as the composed one.
  expect(normalizeTag('laço')).toBe('laço')
  expect(normalizeTag('#loops')).toBe('loops')
  expect(normalizeTag('C#')).toBe('c#')
  expect(normalizeTag('   ')).toBe('')
})

it('accepts letters, numbers, spaces and - . # +', () => {
  for (const tag of ['c#', 'c++', 'node.js', 'off-by-one', 'laço', 'python 3', 'a', 'x'.repeat(NOTE_TAG_LIMITS.tag)]) {
    expect(noteTagProblem(tag)).toBeNull()
  }
  for (const tag of ['<script>', 'a/b', 'emoji 🐛', 'loops!', '...', '-+-']) {
    expect(noteTagProblem(tag)).toBe(NOTE_TAG_CHARS)
  }
  expect(noteTagProblem('x'.repeat(NOTE_TAG_LIMITS.tag + 1))).toBe('Keep each tag up to 24 characters.')
})

it('parses a list: normalized, deduped, empties dropped, at most 8', () => {
  expect(parseNoteTags(['Loops', 'loops', ' LOOPS ', '', 'c++'])).toEqual({ tags: ['loops', 'c++'] })
  expect(parseNoteTags([])).toEqual({ tags: [] })
  expect(parseNoteTags(Array.from({ length: 8 }, (_, i) => `t${i}`)).tags).toHaveLength(8)
  expect(parseNoteTags(Array.from({ length: 9 }, (_, i) => `t${i}`))).toEqual({ problem: 'Use up to 8 tags.' })
  // Nine typed, but two are the same tag: eight is fine.
  expect(parseNoteTags([...Array.from({ length: 8 }, (_, i) => `t${i}`), 'T0']).tags).toHaveLength(8)
  expect(parseNoteTags(['ok', 'not/ok'])).toEqual({ problem: NOTE_TAG_CHARS })
  expect(parseNoteTags('loops')).toEqual({ problem: 'Invalid request.' })
  expect(parseNoteTags([1])).toEqual({ problem: 'Invalid request.' })
})

it('matches every selected tag and counts tags across notes', () => {
  const notes = [{ tags: ['loops', 'javascript'] }, { tags: ['loops'] }, { tags: [] }, {}]
  expect(notes.filter((note) => hasAllTags(note, ['loops']))).toHaveLength(2)
  expect(notes.filter((note) => hasAllTags(note, ['loops', 'javascript']))).toHaveLength(1)
  expect(notes.filter((note) => hasAllTags(note, []))).toHaveLength(4)
  expect(tagCounts([...notes, { tags: ['arrays'] }])).toEqual([
    { tag: 'loops', count: 2 },
    { tag: 'arrays', count: 1 },
    { tag: 'javascript', count: 1 },
  ])
})
