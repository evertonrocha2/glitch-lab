import { CONCEPTS } from '../../shared/concepts.js'
import { LIMITS } from '../../shared/limits.js'

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
  return { ok: true, value: { error, code } }
}

const filled = (value) => typeof value === 'string' && value.trim() !== ''

const CONCEPT_IDS = new Set(CONCEPTS.map((concept) => concept.id))

export function parseAnalysis(data) {
  const { explicacao, causa, correcao, exercicio, concept, language } = data ?? {}
  if (![explicacao, causa, correcao, exercicio?.enunciado, exercicio?.resposta].every(filled)) {
    throw new Error('AI response is missing fields')
  }
  return {
    analysis: {
      explicacao,
      causa,
      correcao,
      exercicio: { enunciado: exercicio.enunciado, resposta: exercicio.resposta },
    },
    concept: CONCEPT_IDS.has(concept) ? concept : 'other',
    language: filled(language) ? language.trim().toLowerCase() : 'unknown',
  }
}
