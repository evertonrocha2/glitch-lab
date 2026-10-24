import { expect, it } from 'vitest'
import { filterNotes, filterParams, readFilters } from './filter.js'

const NOTES = [
  { id: 'n1', title: 'Loops', blocks: [], tags: ['python'], folderId: 'f1' },
  { id: 'n2', title: 'Closures', blocks: [], tags: ['javascript'], folderId: null },
  { id: 'n3', title: 'Loops in JS', blocks: [], tags: ['javascript'], folderId: 'f1' },
  { id: 'n4', title: 'Lost', blocks: [], tags: [], folderId: 'deleted' },
]
const known = new Set(['f1'])
const ids = (notes) => notes.map((note) => note.id)

it('reads the folder, tags and search from the address, and writes them back', () => {
  const filters = readFilters(new URLSearchParams('folder=f1&tag=JavaScript&tag=javascript&q=loop'))
  expect(filters).toEqual({ folder: 'f1', tags: ['javascript'], query: 'loop' })
  expect(filterParams(filters).toString()).toBe('folder=f1&tag=javascript&q=loop')
  expect(readFilters(new URLSearchParams('')).folder).toBeNull()
  expect(filterParams({ folder: null, tags: [], query: '' }).toString()).toBe('')
})

it('narrows by folder, with "none" for the notes outside every folder', () => {
  const all = { tags: [], query: '' }
  expect(ids(filterNotes(NOTES, { ...all, folder: null }, known))).toEqual(['n1', 'n2', 'n3', 'n4'])
  expect(ids(filterNotes(NOTES, { ...all, folder: 'f1' }, known))).toEqual(['n1', 'n3'])
  // A note whose folder is gone shows outside every folder.
  expect(ids(filterNotes(NOTES, { ...all, folder: 'none' }, known))).toEqual(['n2', 'n4'])
})

it('combines the folder with the tags and the search', () => {
  expect(ids(filterNotes(NOTES, { folder: 'f1', tags: ['javascript'], query: '' }, known))).toEqual(['n3'])
  expect(ids(filterNotes(NOTES, { folder: 'f1', tags: [], query: 'js' }, known))).toEqual(['n3'])
  expect(ids(filterNotes(NOTES, { folder: 'none', tags: ['python'], query: '' }, known))).toEqual([])
})
