import {
  FOLDER_NAME_TAKEN,
  folderNameProblem,
  moveFolder,
  NOTE_FOLDER_LIMITS,
  normalizeFolderName,
  TOO_MANY_FOLDERS,
} from '../../../shared/note-folders.js'
import { badRequest, conflict, notFound } from '../../core/errors.js'

const FOLDER_NOT_FOUND = 'Folder not found.'

const validId = (id) => typeof id === 'string' && id !== '' && id.length <= 64

// { name?, position? } from a request body, checked. Missing fields stay undefined.
function parseFolder(body) {
  if (!body) throw badRequest()
  const value = {}
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') throw badRequest()
    value.name = normalizeFolderName(body.name)
    const problem = folderNameProblem(value.name)
    if (problem) throw badRequest(problem)
  }
  if (body.position !== undefined) {
    if (!Number.isInteger(body.position) || body.position < 0) throw badRequest()
    value.position = body.position
  }
  return value
}

const named = (result) => {
  if (result?.conflict) throw conflict(FOLDER_NAME_TAKEN)
  return result
}

export const listFolders = (store, user) => store.listNoteFolders(user.id)

export async function createFolder(store, user, body) {
  const { name } = parseFolder(body)
  if (name === undefined) throw badRequest(folderNameProblem(''))
  const folders = await store.listNoteFolders(user.id)
  if (folders.length >= NOTE_FOLDER_LIMITS.folders) throw conflict(TOO_MANY_FOLDERS)
  // After the last one, even when deleting left gaps in the numbers.
  const position = Math.max(-1, ...folders.map((folder) => folder.position)) + 1
  return named(await store.createNoteFolder(user.id, { name, position })).folder
}

// name renames it; position (0 is the top) moves it, and the folders it passes shift by one.
export async function updateFolder(store, user, id, body) {
  const value = parseFolder(body)
  const folders = validId(id) ? await store.listNoteFolders(user.id) : []
  if (!folders.some((folder) => folder.id === id)) throw notFound(FOLDER_NOT_FOUND)
  if (value.name !== undefined && !named(await store.updateNoteFolder(user.id, id, { name: value.name }))) throw notFound(FOLDER_NOT_FOUND)
  if (value.position !== undefined) {
    // Positions are rewritten as 0, 1, 2...: only the folders whose number changes are written.
    for (const [index, folder] of moveFolder(folders, id, value.position).entries()) {
      if (folder.position !== index) await store.updateNoteFolder(user.id, folder.id, { position: index })
    }
  }
  return (await store.listNoteFolders(user.id)).find((folder) => folder.id === id)
}

// The notes inside are kept: they land outside every folder.
export async function deleteFolder(store, user, id) {
  if (!validId(id) || !(await store.deleteNoteFolder(user.id, id))) throw notFound(FOLDER_NOT_FOUND)
}

// A note's folderId: null takes it out of every folder, an id must be one of my own folders.
export async function assertOwnFolder(store, user, folderId) {
  if (folderId === null || folderId === undefined) return
  const folders = await store.listNoteFolders(user.id)
  if (!folders.some((folder) => folder.id === folderId)) throw notFound(FOLDER_NOT_FOUND)
}
