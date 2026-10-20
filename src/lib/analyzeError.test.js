// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { analyzeError } from './analyzeError.js'

const ANALYSIS = { explicacao: 'a', causa: 'b', correcao: 'c', exercicio: { enunciado: 'd', resposta: 'e' } }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

it('posts error and code as JSON to /api/analyze', async () => {
  fetch.mockResolvedValue(Response.json(ANALYSIS))
  await expect(analyzeError({ error: 'E', code: 'C' })).resolves.toEqual(ANALYSIS)
  expect(fetch).toHaveBeenCalledWith('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'E', code: 'C' }),
  })
})

it('throws the server message on failure', async () => {
  fetch.mockResolvedValue(
    Response.json({ message: 'The AI is busy right now. Try again in a minute.' }, { status: 429 }),
  )
  await expect(analyzeError({ error: 'E', code: '' })).rejects.toThrow(
    'The AI is busy right now. Try again in a minute.',
  )
})

it('throws a generic message when the body has no message', async () => {
  fetch.mockResolvedValue(new Response('oops', { status: 500 }))
  await expect(analyzeError({ error: 'E', code: '' })).rejects.toThrow('Something went wrong. Please try again.')
})

it('throws a connection message when the network fails', async () => {
  fetch.mockRejectedValue(new TypeError('Failed to fetch'))
  await expect(analyzeError({ error: 'E', code: '' })).rejects.toThrow(
    'Could not reach the server. Check your connection.',
  )
})
