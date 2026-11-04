// @vitest-environment node
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'
import { parseTags, TAG_BATCH, tagPrompt, tagSchema, tagUntagged } from '../../scripts/enem/tag.js'
import { AiError } from '../../server/infra/ai/errors.js'
import { createLocalStore } from '../../server/infra/database/local/index.js'
import { examQuestion } from '../server/store-contract-exams.js'

let store

beforeEach(async () => {
  store = createLocalStore({ file: join(await mkdtemp(join(tmpdir(), 'gd-enem-')), 'db.json') })
})

const seed = async (count, overrides = {}) => {
  await store.upsertExamQuestions(Array.from({ length: count }, (_, index) => examQuestion('enem', { number: index + 1, ...overrides })))
  return store.listUntaggedExamQuestions('enem', 100)
}

// Answers every key in the prompt with one topic, the way the model would.
const answerAll = (topic) =>
  vi.fn(async ({ prompt }) => ({ tags: [...prompt.matchAll(/^### (q\d+)$/gm)].map(([, key]) => ({ key, topic })) }))

const silent = () => {}

it('prompts with short keys and only the topics of that area', async () => {
  const [first, second] = await seed(2, { context: 'x'.repeat(3000) })
  const prompt = tagPrompt([first, second], 'matematica')
  expect(prompt).toContain('### q1')
  expect(prompt).toContain('### q2')
  expect(prompt).toContain('funcoes: Funções')
  expect(prompt).not.toContain(first.id)
  expect(prompt).not.toContain('lingua-inglesa')
  expect(prompt).not.toContain('x'.repeat(1501))
  expect(prompt).toContain('x'.repeat(1500))
  expect(tagSchema('matematica').properties.tags.items.properties.topic.enum).toContain('funcoes')
  expect(tagSchema('linguagens').properties.tags.items.properties.topic.enum).not.toContain('lingua-espanhola')
})

it('shows images as a placeholder in the prompt', async () => {
  const [question] = await seed(1, { context: 'Veja:\n\n![](https://enem.dev/a.png)' })
  const prompt = tagPrompt([question], 'matematica')
  expect(prompt).toContain('[imagem]')
  expect(prompt).not.toContain('https://enem.dev/a.png')
})

it('keeps only valid keys and topics of that area', async () => {
  const qs = await seed(2)
  const answer = {
    tags: [
      { key: 'q1', topic: 'funcoes' },
      { key: 'q2', topic: 'filosofia' },
      { key: 'q9', topic: 'funcoes' },
      { key: 'q1', topic: 'estatistica' },
    ],
  }
  expect(parseTags(answer, qs, 'matematica')).toEqual(new Map([[qs[0].id, 'funcoes']]))
  expect(parseTags(null, qs, 'matematica')).toEqual(new Map())
  expect(parseTags({ tags: 'nope' }, qs, 'matematica')).toEqual(new Map())
})

it('tags every untagged question in batches of 10', async () => {
  await seed(12)
  const generate = answerAll('funcoes')
  expect(TAG_BATCH).toBe(10)
  expect(await tagUntagged(store, { generate, log: silent })).toEqual({ tagged: 12, skipped: 0 })
  expect(generate).toHaveBeenCalledTimes(2)
  expect(generate.mock.calls[0][0]).toMatchObject({ system: expect.any(String), schema: tagSchema('matematica') })
  expect(await store.countExamQuestionsByTopic('enem')).toEqual({ funcoes: 12 })
})

it('skips a batch when the AI fails and stops when nothing changes', async () => {
  await seed(12)
  const generate = vi.fn().mockRejectedValue(new AiError(503, 'busy'))
  expect(await tagUntagged(store, { generate, log: silent })).toEqual({ tagged: 0, skipped: 12 })
  expect(generate).toHaveBeenCalledTimes(2)
})

it('lets other errors through', async () => {
  await seed(1)
  await expect(tagUntagged(store, { generate: vi.fn().mockRejectedValue(new TypeError('bug')), log: silent })).rejects.toThrow('bug')
})
