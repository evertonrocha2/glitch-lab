import { expect, it } from 'vitest'
import { createSseParser } from '../../shared/sse.js'

const parse = (chunks) => {
  const events = []
  const parser = createSseParser((event) => events.push(event))
  for (const chunk of chunks) parser.push(chunk)
  parser.end()
  return events
}

it('reads named events and plain data events', () => {
  expect(parse(['event: step\ndata: {"a":1}\n\ndata: hi\n\n'])).toEqual([
    { event: 'step', data: '{"a":1}' },
    { event: 'message', data: 'hi' },
  ])
})

it('joins events split anywhere across chunks, even inside CRLF', () => {
  const text = 'event: delta\r\ndata: {"text":"Hel"}\r\n\r\nevent: delta\r\ndata: {"text":"lo"}\r\n\r\n'
  const expected = [
    { event: 'delta', data: '{"text":"Hel"}' },
    { event: 'delta', data: '{"text":"lo"}' },
  ]
  expect(parse(text.split(''))).toEqual(expected)
  const crlf = text.indexOf('\r\n')
  expect(parse([text.slice(0, crlf + 1), text.slice(crlf + 1)])).toEqual(expected)
})

it('skips comments and keeps multi-line data', () => {
  expect(parse([': OPENROUTER PROCESSING\n\n', 'data: one\ndata: two\n\n', ': keep-alive\n\n'])).toEqual([{ event: 'message', data: 'one\ntwo' }])
})

it('keeps the last event even without its blank line', () => {
  expect(parse(['data: [DONE]'])).toEqual([{ event: 'message', data: '[DONE]' }])
})

it('takes the value as is after one optional space', () => {
  expect(parse(['data:no-space\n\ndata:  two spaces\n\n']).map((event) => event.data)).toEqual(['no-space', ' two spaces'])
})
