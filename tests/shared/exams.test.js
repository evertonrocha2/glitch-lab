// @vitest-environment node
import { expect, it } from 'vitest'
import { examById, topicById, topicsOfArea, trackById } from '../../shared/exams/catalog.js'
import { ENEM, FOREIGN_LANGUAGE_TOPIC } from '../../shared/exams/enem.js'
import { parseQuestionText } from '../../shared/exams/question-text.js'

it('finds topics and their area', () => {
  expect(topicById('enem', 'funcoes')).toEqual({ id: 'funcoes', name: 'Funções', area: 'matematica' })
  expect(topicById('enem', 'nope')).toBeNull()
  expect(topicById('esa', 'funcoes')).toBeNull()
  expect(examById('enem').areas.map((a) => a.id)).toEqual(['linguagens', 'humanas', 'natureza', 'matematica'])
  expect(examById('esa')).toBeNull()
  expect(topicsOfArea('enem', 'linguagens').map((t) => t.id)).toContain('lingua-inglesa')
  expect(topicsOfArea('enem', 'nope')).toEqual([])
})

it('never repeats a topic id across the exam', () => {
  const ids = ENEM.areas.flatMap((a) => a.topics.map((t) => t.id))
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids).toHaveLength(47)
})

it('gives each foreign language its own topic', () => {
  expect(FOREIGN_LANGUAGE_TOPIC).toEqual({ ingles: 'lingua-inglesa', espanhol: 'lingua-espanhola' })
  expect(topicById('enem', 'lingua-espanhola').area).toBe('linguagens')
})

it('knows the tracks', () => {
  expect(trackById('enem')).toEqual({ id: 'enem', exam: 'enem' })
  expect(trackById('programming')).toEqual({ id: 'programming', exam: null })
  expect(trackById('esa')).toBeNull()
  expect(trackById('__proto__')).toBeNull()
})

it('turns question markdown into paragraphs and images', () => {
  expect(parseQuestionText('**TEXTO I**\n\nUm *poema*  \nsegunda linha\n\n![mapa](https://enem.dev/a.png)')).toEqual([
    { type: 'paragraph', parts: [{ text: 'TEXTO I', bold: true }] },
    { type: 'paragraph', parts: [{ text: 'Um ' }, { text: 'poema', italic: true }, { text: '\nsegunda linha' }] },
    { type: 'image', src: 'https://enem.dev/a.png', alt: 'mapa' },
  ])
})

it('keeps hostile markup as text and drops unsafe images', () => {
  expect(parseQuestionText('<script>alert(1)</script>')).toEqual([{ type: 'paragraph', parts: [{ text: '<script>alert(1)</script>' }] }])
  expect(parseQuestionText('![](javascript:alert(1))\n\n![](http://x.dev/a.png)\n\n![](https://enem.dev/broken-image.svg)')).toEqual([])
  expect(parseQuestionText(null)).toEqual([])
  expect(parseQuestionText('   \n\n  ')).toEqual([])
})

it('reads underscores as italic and leaves a lone star alone', () => {
  expect(parseQuestionText('a _b_ 2 * 3')).toEqual([{ type: 'paragraph', parts: [{ text: 'a ' }, { text: 'b', italic: true }, { text: ' 2 * 3' }] }])
})

it('splits an image out of the middle of a paragraph', () => {
  expect(parseQuestionText('antes\n![](https://enem.dev/x.png)\ndepois')).toEqual([
    { type: 'paragraph', parts: [{ text: 'antes' }] },
    { type: 'image', src: 'https://enem.dev/x.png', alt: '' },
    { type: 'paragraph', parts: [{ text: 'depois' }] },
  ])
})
