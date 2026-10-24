import { expect, it } from 'vitest'
import { folderCounts, folderNameProblem, moveFolder, NOTE_FOLDER_LIMITS, normalizeFolderName, sameFolderName } from '../../shared/note-folders.js'

it('tidies a folder name and checks it', () => {
  expect(normalizeFolderName('  Estudos   de\tJS ')).toBe('Estudos de JS')
  expect(folderNameProblem('')).toBe('Give the folder a name.')
  expect(folderNameProblem('a'.repeat(NOTE_FOLDER_LIMITS.name + 1))).toBe('Keep the folder name up to 40 characters.')
  expect(folderNameProblem('a'.repeat(NOTE_FOLDER_LIMITS.name))).toBeNull()
  expect(sameFolderName('Loops', 'LOOPS')).toBe(true)
})

it('counts notes per folder, a note in a deleted folder counting as outside', () => {
  const folders = [{ id: 'a' }, { id: 'b' }]
  const notes = [{ folderId: 'a' }, { folderId: 'a' }, { folderId: null }, {}, { folderId: 'gone' }]
  const counts = folderCounts(notes, folders)
  expect(counts.all).toBe(5)
  expect(counts.none).toBe(3)
  expect(counts.byFolder.get('a')).toBe(2)
  expect(counts.byFolder.get('b')).toBe(0)
})

it('moves a folder to a new index, clamped, and leaves the list alone when nothing moves', () => {
  const list = ['a', 'b', 'c'].map((id) => ({ id }))
  const ids = (folders) => folders.map((folder) => folder.id)
  expect(ids(moveFolder(list, 'c', 0))).toEqual(['c', 'a', 'b'])
  expect(ids(moveFolder(list, 'a', 99))).toEqual(['b', 'c', 'a'])
  expect(ids(moveFolder(list, 'b', -3))).toEqual(['b', 'a', 'c'])
  expect(moveFolder(list, 'b', 1)).toBe(list)
  expect(moveFolder(list, 'nope', 0)).toBe(list)
})
