// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { buildRouterPrompt, parseRoute, ROUTER_SCHEMA, routeQuestion } from '../../server/modules/assistant/router.js'

const ask = (content) => [{ role: 'user', content }]

it('keeps known specialists and the data each one may load', () => {
  const route = parseRoute({
    specialists: [
      { name: 'board', needs: ['current_case', 'notes_of_bob'], focus: 'the open case' },
      { name: 'hacker', needs: [] },
      { name: 'gym', needs: ['challenge_list'] },
    ],
  })
  expect(route).toEqual([
    { name: 'board', needs: ['current_case'], focus: 'the open case' },
    { name: 'gym', needs: ['challenge_list'], focus: '' },
  ])
})

it('asks at most two specialists, each once', () => {
  const route = parseRoute({
    specialists: [{ name: 'notes', needs: [] }, { name: 'notes', needs: [] }, { name: 'study', needs: [] }, { name: 'guide', needs: [] }],
  })
  expect(route.map((item) => item.name)).toEqual(['notes', 'study'])
})

it('gives a specialist all of its data when the router names none', () => {
  expect(parseRoute({ specialists: [{ name: 'notes' }] })).toEqual([{ name: 'notes', needs: ['note_list', 'current_note'], focus: '' }])
})

it('refuses an answer with no usable specialist', () => {
  expect(() => parseRoute({ specialists: [{ name: 'hacker' }] })).toThrow()
  expect(() => parseRoute(null)).toThrow()
})

it('lists the specialists in the schema', () => {
  const name = ROUTER_SCHEMA.properties.specialists.items.properties.name
  expect(name.enum).toEqual(['board', 'gym', 'notes', 'study', 'guide'])
})

it('tells the router the page and fences the conversation as data', () => {
  const prompt = buildRouterPrompt({ messages: ask('why does this case happen?'), page: { path: '/board', caseId: 'c1' } })
  expect(prompt).toContain('/board')
  expect(prompt).toContain('open case: c1')
  expect(prompt).toContain('<conversation>')
  expect(prompt).toContain('why does this case happen?')
})

it('routes with the AI answer', async () => {
  const generate = vi.fn().mockResolvedValue({ specialists: [{ name: 'study', needs: ['progress'], focus: 'level' }] })
  const result = await routeQuestion(generate, { messages: ask('how close am I to the next level?'), page: { path: '/' } })
  expect(result).toEqual({ route: [{ name: 'study', needs: ['progress'], focus: 'level' }], fellBack: false })
  expect(generate).toHaveBeenCalledWith(expect.objectContaining({ schema: ROUTER_SCHEMA }))
})

it('falls back to keywords and the page when the router fails', async () => {
  const generate = vi.fn().mockRejectedValue(new Error('busy'))
  const result = await routeQuestion(generate, { messages: ask('Summarize my notes'), page: { path: '/board' } })
  expect(result).toEqual({ route: [{ name: 'notes', needs: ['note_list', 'current_note'], focus: '' }], fellBack: true })
})

it('falls back when the router answers nonsense', async () => {
  const generate = vi.fn().mockResolvedValue({ specialists: 'everyone' })
  const result = await routeQuestion(generate, { messages: ask('hello'), page: { path: '/gym/ch1', challengeId: 'ch1' } })
  expect(result.fellBack).toBe(true)
  expect(result.route.map((item) => item.name)).toEqual(['gym'])
})
