// @vitest-environment node
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE, ENEM_YEARS, fetchYear, toQuestionRow } from '../../scripts/enem/source.js'

// Questions 1, 2, 136 and 141 of ENEM 2023 as api.enem.dev answers them, so these tests never touch
// the network.
const page = JSON.parse(readFileSync(new URL('../fixtures/enem/questions-2023.json', import.meta.url), 'utf8'))
const question = (index) => structuredClone(page.questions.find((item) => item.index === index))

afterEach(() => vi.useRealTimers())

describe('toQuestionRow', () => {
  it('maps an API question to a row', () => {
    const api = question(136)
    const row = toQuestionRow(api)
    expect(row).toMatchObject({
      exam: 'enem',
      year: 2023,
      number: 136,
      area: 'matematica',
      language: null,
      topic: null,
      statement: api.alternativesIntroduction,
      answer: 'B',
      needsReview: false,
      sourceKey: 'enem.dev:2023:136:-',
    })
    expect(row.alternatives).toHaveLength(5)
    expect(row.alternatives[0]).toEqual({ letter: 'A', text: api.alternatives[0].text, image: null })
    expect(row.context).toContain(api.files[0])
  })

  it('adds files the context does not show yet', () => {
    const api = { ...question(136), context: 'Veja a figura.' }
    expect(toQuestionRow(api).context).toBe(`Veja a figura.\n\n![](${api.files[0]})`)
  })

  it('keeps alternatives that are images', () => {
    const row = toQuestionRow(question(141))
    expect(row.needsReview).toBe(false)
    expect(row.alternatives.every((item) => item.image?.startsWith('https://'))).toBe(true)
  })

  it('gives foreign language questions their own topic', () => {
    expect(toQuestionRow(question(2))).toMatchObject({ language: 'espanhol', topic: 'lingua-espanhola', sourceKey: 'enem.dev:2023:2:espanhol' })
    expect(toQuestionRow({ ...question(2), language: 'ingles' }).topic).toBe('lingua-inglesa')
  })

  it('flags broken images for review', () => {
    expect(toQuestionRow(question(1)).needsReview).toBe(true)
  })

  it('flags questions without five usable alternatives for review', () => {
    const api = question(136)
    expect(toQuestionRow({ ...api, alternatives: api.alternatives.slice(0, 4) }).needsReview).toBe(true)
    const blank = api.alternatives.map((item, index) => (index === 2 ? { ...item, text: '', file: null } : item))
    expect(toQuestionRow({ ...api, alternatives: blank }).needsReview).toBe(true)
  })

  it('skips questions without a valid answer or area', () => {
    expect(toQuestionRow({ ...question(136), correctAlternative: null })).toBeNull()
    expect(toQuestionRow({ ...question(136), correctAlternative: 'F' })).toBeNull()
    expect(toQuestionRow({ ...question(136), discipline: 'redacao' })).toBeNull()
  })
})

describe('fetchYear', () => {
  it('covers 2019 to 2023', () => {
    expect(ENEM_YEARS).toEqual([2019, 2020, 2021, 2022, 2023])
    expect(API_BASE).toBe('https://api.enem.dev/v1')
  })

  it('pages through a year', async () => {
    vi.useFakeTimers()
    const a = question(2)
    const b = question(136)
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ metadata: { hasMore: true }, questions: [a] }))
      .mockResolvedValueOnce(Response.json({ metadata: { hasMore: false }, questions: [b] }))
    const result = fetchYear(2023, { fetch })
    await vi.runAllTimersAsync()
    expect(await result).toEqual([a, b])
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://api.enem.dev/v1/exams/2023/questions?limit=50&offset=0',
      'https://api.enem.dev/v1/exams/2023/questions?limit=50&offset=50',
    ])
  })

  it('fails loudly on an HTTP error', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }))
    await expect(fetchYear(2023, { fetch })).rejects.toThrow(/2023.*500|500.*2023/)
  })
})
