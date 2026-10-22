import { excerpt, isCodePath, matchFile } from '../../shared/errorScan.js'
import { LIMITS } from '../../shared/limits.js'

// Folders nobody wants to send: dependencies, build output, virtual envs, version control.
const SKIP_DIRS = /(^|\/)(node_modules|\.git|dist|build|\.next|\.nuxt|out|coverage|venv|\.venv|env|__pycache__|target|bin|obj|vendor|\.idea|\.vscode)\//
export const MAX_FILE_BYTES = 300_000
// A folder can hold thousands of files; past this many code files we stop reading.
export const MAX_FILES_READ = 400
// Files longer than this are sent as the lines around the error, not whole.
const LONG_FILE_LINES = 80

const normalize = (path) => path.replace(/\\/g, '/')

// FileList (from files, a folder or a drop) -> { files: [{ path, content }], skipped }
export async function readFiles(list) {
  const files = []
  let skipped = 0
  for (const file of list) {
    const path = normalize(file.webkitRelativePath || file.name)
    if (!isCodePath(path) || SKIP_DIRS.test(path) || file.size > MAX_FILE_BYTES || files.length >= MAX_FILES_READ) {
      skipped++
      continue
    }
    files.push({ path, content: await file.text() })
  }
  return { files, skipped }
}

// Adds new files to the list; a file read again replaces the old copy.
export function mergeFiles(current, added) {
  const byPath = new Map(current.map((file) => [file.path, file]))
  for (const file of added) byPath.set(file.path, file)
  return [...byPath.values()]
}

// path -> the line the error points at in that file, for every attached file the error mentions.
export function mentionedLines(files, locations) {
  const lines = new Map()
  for (const location of locations) {
    const file = matchFile(files, location)
    if (file && !lines.has(file.path)) lines.set(file.path, location.line)
  }
  return lines
}

// Which files to tick by default: the ones the error mentions, or all of them when there are only a few.
export function suggestSelection(files, mentioned) {
  if (mentioned.size) return new Set([...mentioned.keys()].slice(0, LIMITS.files))
  return files.length <= LIMITS.files ? new Set(files.map((file) => file.path)) : new Set()
}

function cut(content, budget) {
  if (content.length <= budget) return content
  const note = '\n... (cut here, the file is longer)'
  return content.slice(0, Math.max(0, budget - note.length)) + note
}

// What goes to the server: long files shrink to the lines around the error, and everything fits the limits.
export function preparePayload(files, selected, mentioned) {
  const chosen = files.filter((file) => selected.has(file.path)).slice(0, LIMITS.files)
  if (chosen.length === 0) return []
  const budget = Math.min(LIMITS.code, Math.floor(LIMITS.filesTotal / chosen.length))
  return chosen.map((file) => {
    const line = mentioned.get(file.path)
    const long = file.content.split('\n').length > LONG_FILE_LINES || file.content.length > budget
    const content = line && long ? excerpt(file.content, line) : file.content
    return { path: file.path.slice(-LIMITS.path), content: cut(content, budget) }
  })
}
