import { NOTE_LIMITS } from '../../../shared/limits.js'
import { NOTE_AI_LIMITS, NOTE_AI_TOO_LONG } from '../../../shared/note-ai.js'
import { noteAsText } from '../../../shared/note-blocks.js'
import { caseText } from '../../../shared/question.js'
import { AppError, badRequest, conflict, notFound, valueOrThrow } from '../../core/errors.js'
import { withAi } from '../../infra/ai/failure.js'
import { createBoundary, findLeak, GUARD_TEXT, screenInput } from '../../infra/ai/guard/index.js'
import { spendAiCall } from '../../infra/ai/quota.js'
import { aiItems, hasWriting, noteLanguage, parseAiRequest, resolveBlocks, scopeBlocks, summaryBlocks } from './note-ai.model.js'
import { buildNoteAiPrompt, NOTE_AI_SCHEMA, noteAiSystem } from './note-ai.prompt.js'

export const NOTE_AI_REPEAT_MS = 10 * 60 * 1000
const CACHE_MAX = 500

const NOTE_NOT_FOUND = 'Note not found.'

// The same request on the same version of a note within 10 minutes (a double click, Stop then try
// again, Discard then a second look) gets the answer it already paid for. In memory: the API runs as
// one process, and losing this on a restart only costs one more call.
const answers = new Map()

function remembered(key, now) {
  const hit = answers.get(key)
  if (hit && now - hit.at < NOTE_AI_REPEAT_MS) return hit.value
  if (hit) answers.delete(key)
  return null
}

function remember(key, value, now) {
  answers.set(key, { at: now, value })
  // Oldest first in a Map: drop from the front once it's full.
  while (answers.size > CACHE_MAX) answers.delete(answers.keys().next().value)
}

export const forgetNoteAiAnswers = () => answers.clear()

// The guard reads the note like any text a student wrote: prose as prose, code as code.
function guardFields(title, scope) {
  const prose = [title, ...scope.filter((block) => typeof block.text === 'string' && block.type !== 'code').map((block) => block.text)].filter(Boolean)
  const code = scope.filter((block) => block.type === 'code').map((block) => ({ text: block.text, prose: false }))
  const joined = prose.join('\n')
  return { fields: [...prose.map((text) => ({ text })), ...code], scope: joined.trim() ? [joined] : [], feature: 'notes-ai' }
}

// A blocked or unusable answer, as the error the editor shows. English: the client translates it.
const guardError = (kind) => new AppError(422, (GUARD_TEXT[kind] ?? GUARD_TEXT.off_topic).en, 'AI_GUARD')

// POST /notes/:id/ai { action, blockIds? }: the blocks that would replace the ones in scope (the
// whole note without blockIds). Nothing is saved: the editor shows a preview and the writer decides.
export async function noteAi({ store, ai }, user, id, body, locale, now = Date.now()) {
  const { action, blockIds } = valueOrThrow(parseAiRequest(body ?? {}))
  const note = typeof id === 'string' && id.length <= 64 ? await store.getNote(user.id, id) : null
  if (!note) throw notFound(NOTE_NOT_FOUND)
  const scope = scopeBlocks(note.blocks, blockIds)
  if (!scope) throw conflict('Some of these blocks are not saved yet. Try again in a moment.')
  if (!hasWriting(scope)) throw badRequest('Nothing to work on here. Write a few words first.')

  const cases = scope.some((block) => block.type === 'case') ? await store.listCases(user.id) : []
  const caseLabel = (caseId) => {
    const kase = cases.find((item) => item.id === caseId)
    return kase ? caseText(kase).split('\n')[0].slice(0, 120) : 'a case no longer on the board'
  }
  const size = note.title.length + noteAsText(scope, (block) => caseLabel(block.caseId)).length
  if (size > NOTE_AI_LIMITS.chars) throw new AppError(413, NOTE_AI_TOO_LONG)

  const key = [user.id, note.id, note.updatedAt, action, blockIds ? [...blockIds].sort().join(',') : '*'].join('|')
  const repeat = remembered(key, now)
  if (repeat) return { ...repeat, cached: true }

  const blocked = await screenInput(store, user, guardFields(note.title, scope))
  if (blocked) throw guardError(blocked.kind)
  await spendAiCall(store, user)

  const language = noteLanguage(scope, note.title) ?? locale
  const boundary = createBoundary()
  const result = await withAi(async () => {
    const answer = await ai.generateJson({
      system: noteAiSystem(action, language, { boundary }),
      prompt: buildNoteAiPrompt({ title: note.title, items: aiItems(scope, caseLabel), partial: Boolean(blockIds) }, boundary),
      schema: NOTE_AI_SCHEMA,
    })
    if (answer?.off_topic === true) return { problem: 'off_topic' }
    if (findLeak(JSON.stringify(answer), { boundary })) return { problem: 'leak' }
    return action === 'summarize' ? summaryBlocks(answer?.summary, scope, language) : resolveBlocks(answer?.blocks, scope)
  })
  if (result.problem === 'code') throw new AppError(422, "Couldn't improve this without touching your code. Nothing was changed.", 'AI_CODE_CHANGED')
  if (result.problem === 'off_topic' || result.problem === 'leak') throw guardError(result.problem)
  // The note after the swap must still fit in a note.
  if (result.problem || note.blocks.length - scope.length + result.blocks.length > NOTE_LIMITS.blocks) {
    throw new AppError(502, "The AI's answer didn't fit your note. Try again.", 'AI_FAILED')
  }

  const value = { action, blockIds: scope.map((block) => block.id), blocks: result.blocks, language }
  remember(key, value, now)
  return { ...value, cached: false }
}
