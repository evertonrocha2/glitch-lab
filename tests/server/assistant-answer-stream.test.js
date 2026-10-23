// @vitest-environment node
import { expect, it } from 'vitest'
import { createReplyFilter, splitActions } from '../../server/modules/assistant/answer-stream.js'
import { parseStreamedAnswer } from '../../server/modules/assistant/specialists.js'

// What the student would see, chunk by chunk.
function run(chunks) {
  const seen = []
  const filter = createReplyFilter((text) => seen.push(text))
  const after = chunks.map((chunk) => {
    filter.push(chunk)
    return seen.join('')
  })
  filter.end()
  return { after, text: seen.join('') }
}

const ANSWER = 'Look at line 3.\nWhat does it print?\nACTIONS: [{"type":"go","target":"/board","label":"Board"}]'

it('never shows the actions line, wherever the chunks split', () => {
  for (let size = 1; size <= ANSWER.length; size++) {
    const chunks = []
    for (let at = 0; at < ANSWER.length; at += size) chunks.push(ANSWER.slice(at, at + size))
    const { after, text } = run(chunks)
    expect(text).toBe('Look at line 3.\nWhat does it print?\n')
    for (const shown of after) expect(shown).not.toMatch(/ACT|\[\{/)
  }
})

it('holds back only a line that could still become the marker', () => {
  const { after } = run(['Line one\nACT', 'UALLY it works', '\nAC'])
  expect(after[0]).toBe('Line one\n')
  expect(after[1]).toBe('Line one\nACTUALLY it works')
  expect(after[2]).toBe('Line one\nACTUALLY it works\n')
})

it('lets the held tail out at the end when it was not the marker', () => {
  expect(run(['Done.\nAC']).text).toBe('Done.\nAC')
})

it('passes "actions" in the middle of a sentence', () => {
  expect(run(['Your next ACTIONS: train the case.']).text).toBe('Your next ACTIONS: train the case.')
})

it('also stops at a marker dressed up in markdown', () => {
  expect(run(['Hi.\n**ACTIONS:** []']).text).toBe('Hi.\n')
})

it('splits the finished text into the reply and the actions', () => {
  expect(splitActions(ANSWER)).toEqual({ reply: 'Look at line 3.\nWhat does it print?', actions: [{ type: 'go', target: '/board', label: 'Board' }] })
  expect(splitActions('Just text, no marker.')).toEqual({ reply: 'Just text, no marker.', actions: [] })
  expect(splitActions('Hi\nACTIONS: not json')).toEqual({ reply: 'Hi', actions: [] })
  expect(splitActions('Hi\nACTIONS: ```json\n[{"type":"start_timer","target":"","label":"Go"}]\n```')).toEqual({
    reply: 'Hi',
    actions: [{ type: 'start_timer', target: '', label: 'Go' }],
  })
})

it('parses a streamed answer like a JSON one, em dashes out', () => {
  expect(parseStreamedAnswer('Read it — slowly.\nACTIONS: []')).toEqual({ reply: 'Read it, slowly.', actions: [] })
  expect(() => parseStreamedAnswer('ACTIONS: []')).toThrow()
})
