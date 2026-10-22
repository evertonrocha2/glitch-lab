import { expect, it } from 'vitest'
import { pageKind, pickSpecialists, SPECIALISTS, specialistName, SUGGESTIONS } from '../../shared/assistant.js'

it('names every specialist', () => {
  expect(SPECIALISTS.map((item) => item.id)).toEqual(['board', 'gym', 'notes', 'study', 'guide'])
  expect(specialistName('gym')).toBe('Gym coach')
  expect(specialistName('nope')).toBe('Assistant')
})

it('tells which page the student is on', () => {
  expect(pageKind('/board')).toBe('board')
  expect(pageKind('/gym/ch1')).toBe('gym')
  expect(pageKind('/notes')).toBe('notes')
  expect(pageKind('/notes/n1')).toBe('notes')
  expect(pageKind('/progress')).toBe('progress')
  expect(pageKind('/')).toBe('other')
  expect(pageKind(undefined)).toBe('other')
})

it('picks specialists from keywords', () => {
  expect(pickSpecialists('What is my weak spot?', { path: '/board' })).toEqual(['board'])
  expect(pickSpecialists('Give me a hint without spoiling it', { path: '/gym/ch1' })).toEqual(['gym'])
  expect(pickSpecialists('Summarize my notes', { path: '/notes' })).toEqual(['notes'])
  expect(pickSpecialists('Plan my next 30 minutes', { path: '/board' })).toEqual(['study'])
  expect(pickSpecialists('How do I export a note?', { path: '/progress' })).toEqual(['guide', 'notes'])
})

it('asks at most two specialists', () => {
  expect(pickSpecialists('my notes, my cases, my streak and a hint', { path: '/' })).toHaveLength(2)
})

it('falls back to the page when no keyword matches', () => {
  expect(pickSpecialists('hello there', { path: '/gym/ch1' })).toEqual(['gym'])
  expect(pickSpecialists('hello there', { path: '/progress' })).toEqual(['study'])
  expect(pickSpecialists('hello there', { path: '/' })).toEqual(['guide'])
})

it('suggests prompts for every kind of page', () => {
  for (const kind of ['board', 'gym', 'notes', 'progress', 'other']) expect(SUGGESTIONS[kind].length).toBeGreaterThanOrEqual(3)
  expect(SUGGESTIONS.board).toContain('What is my weak spot?')
  expect(SUGGESTIONS.gym).toContain('Give me a hint without spoiling it')
})
