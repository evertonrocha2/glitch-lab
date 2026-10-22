// @vitest-environment node
import { expect, it } from 'vitest'
import { parseAnalysis } from '../../api/_lib/analysis.js'
import { RESPONSE_SCHEMA } from '../../api/_lib/prompts/analyze.js'
import { CONCEPTS, conceptLabel } from '../../shared/concepts.js'

const ANALYSIS = { explicacao: 'a', causa: 'b', correcao: 'c', exercicio: { enunciado: 'd', resposta: 'e' } }

it('keeps a known concept and the language', () => {
  expect(parseAnalysis({ ...ANALYSIS, concept: 'index-out-of-range', language: 'Python' })).toEqual({
    analysis: ANALYSIS,
    concept: 'index-out-of-range',
    language: 'python',
  })
})

it('falls back to other for an unknown concept', () => {
  expect(parseAnalysis({ ...ANALYSIS, concept: 'cosmic-rays', language: 'js' }).concept).toBe('other')
})

it('marks a missing language as unknown', () => {
  expect(parseAnalysis({ ...ANALYSIS, concept: 'other', language: '  ' }).language).toBe('unknown')
})

it('asks the AI for one of the known concepts', () => {
  expect(RESPONSE_SCHEMA.properties.concept.enum).toEqual(CONCEPTS.map((concept) => concept.id))
  expect(RESPONSE_SCHEMA.required).toEqual(expect.arrayContaining(['concept', 'language']))
})

it('rejects an analysis with an empty field', () => {
  expect(() => parseAnalysis({ ...ANALYSIS, causa: ' ', concept: 'other', language: 'js' })).toThrow()
})

it('names each concept for people', () => {
  expect(conceptLabel('undefined-access')).toBe('Reading undefined')
  expect(conceptLabel('nope')).toBe('Other')
})

it('keeps up to four clues and where the bug likely is', () => {
  const parsed = parseAnalysis({
    ...ANALYSIS,
    concept: 'other',
    language: 'js',
    pistas: ["It read 'length'", ' ', 'From undefined', 'c', 'd', 'e'],
    local: '  cart.js, line 12  ',
  })
  expect(parsed.analysis.pistas).toEqual(["It read 'length'", 'From undefined', 'c', 'd'])
  expect(parsed.analysis.local).toBe('cart.js, line 12')
})

it('leaves clues out when the AI gives none', () => {
  const parsed = parseAnalysis({ ...ANALYSIS, concept: 'other', language: 'js' })
  expect(parsed.analysis).toEqual(ANALYSIS)
})
