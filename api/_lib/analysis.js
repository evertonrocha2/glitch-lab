import { CONCEPTS } from '../../shared/concepts.js'
import { LIMITS } from '../../shared/limits.js'

const tooLong = (message) => ({ ok: false, status: 413, message })
const invalid = { ok: false, status: 400, message: 'Invalid request.' }

// { ok, value: [{ path, content }] } with only those two fields kept.
function validateFiles(files) {
  if (files === undefined) return { ok: true, value: [] }
  if (!Array.isArray(files)) return invalid
  if (files.length > LIMITS.files) return tooLong(`Attach up to ${LIMITS.files} files.`)
  const value = []
  let total = 0
  for (const file of files) {
    if (typeof file?.path !== 'string' || typeof file.content !== 'string' || !file.path.trim()) return invalid
    if (file.path.length > LIMITS.path || file.content.length > LIMITS.code) {
      return tooLong(`Too long. Keep each file under ${LIMITS.code} characters.`)
    }
    total += file.content.length
    value.push({ path: file.path.trim(), content: file.content })
  }
  if (total > LIMITS.filesTotal) return tooLong(`Too long. Keep all files together under ${LIMITS.filesTotal} characters.`)
  return { ok: true, value }
}

export function validateInput(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, message: 'Invalid request.' }
  }
  const error = typeof body.error === 'string' ? body.error.trim() : ''
  // Never trim the code: indentation can be the bug itself.
  const code = typeof body.code === 'string' ? body.code : ''

  if (!error) {
    return { ok: false, status: 400, message: 'Paste an error message first.' }
  }
  if (error.length > LIMITS.error || code.length > LIMITS.code) {
    return {
      ok: false,
      status: 413,
      message: `Too long. Keep the error under ${LIMITS.error} characters and the code under ${LIMITS.code}.`,
    }
  }
  const context = typeof body.context === 'string' ? body.context.trim() : ''
  if (context.length > LIMITS.context) return tooLong(`Too long. Keep "what you were doing" under ${LIMITS.context} characters.`)
  const files = validateFiles(body.files)
  if (!files.ok) return files
  return { ok: true, value: { error, code, context, files: files.value } }
}

const filled = (value) => typeof value === 'string' && value.trim() !== ''

const CONCEPT_IDS = new Set(CONCEPTS.map((concept) => concept.id))

const MAX_CLUES = 4

export function parseAnalysis(data) {
  const { explicacao, causa, correcao, exercicio, concept, language, pistas, local } = data ?? {}
  if (![explicacao, causa, correcao, exercicio?.enunciado, exercicio?.resposta].every(filled)) {
    throw new Error('AI response is missing fields')
  }
  const clues = Array.isArray(pistas) ? pistas.filter(filled).map((clue) => clue.trim()).slice(0, MAX_CLUES) : []
  return {
    analysis: {
      explicacao,
      causa,
      correcao,
      exercicio: { enunciado: exercicio.enunciado, resposta: exercicio.resposta },
      // Clues and the likely spot are extras: older cases don't have them.
      ...(clues.length ? { pistas: clues } : {}),
      ...(filled(local) ? { local: local.trim() } : {}),
    },
    concept: CONCEPT_IDS.has(concept) ? concept : 'other',
    language: filled(language) ? language.trim().toLowerCase() : 'unknown',
  }
}
