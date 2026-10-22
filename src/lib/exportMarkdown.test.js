import { expect, it } from 'vitest'
import { BADGES } from '../../shared/badges.js'
import { boardToMarkdown, noteToMarkdown, slug } from './exportMarkdown.js'

const analysis = { explicacao: 'It was undefined.', causa: 'No name yet.', correcao: 'user.name?.length', exercicio: { enunciado: 'book.title.x', resposta: 'add a title' } }
const CASES = [
  { id: 'c1', status: 'training', passedCount: 1, error: 'TypeError: boom', code: 'a.b.c', concept: 'undefined-access', language: 'javascript', analysis },
  { id: 'c2', status: 'solved', passedCount: 2, error: 'IndexError: out', code: '', concept: 'index-out-of-range', language: 'python', analysis },
]
const NOTE = {
  id: 'n1',
  title: 'Undefined again',
  blocks: [
    { id: 'b1', type: 'heading', text: 'Pattern' },
    { id: 'b2', type: 'text', text: 'Check before reading.' },
    { id: 'b3', type: 'text', text: '   ' },
    { id: 'b4', type: 'todo', text: 'Use ?.', done: true },
    { id: 'b5', type: 'todo', text: 'Second pass', done: false },
    { id: 'b6', type: 'case', caseId: 'c1' },
    { id: 'b7', type: 'case', caseId: 'gone' },
  ],
}

it('writes a note as Markdown', () => {
  const blocks = [
    '# Undefined again',
    '## Pattern',
    'Check before reading.',
    '- [x] Use ?.',
    '- [ ] Second pass',
    '> **Case:** TypeError: boom\n> Reading undefined · javascript · Training (1/2)',
    '> **Case:** (no longer on the board)',
  ]
  expect(noteToMarkdown(NOTE, CASES)).toBe(`${blocks.join('\n\n')}\n`)
})

it('writes the board by column, with progress and notes', () => {
  const progress = {
    level: 2,
    title: 'Junior Detective',
    xp: 145,
    streak: 3,
    totalSeconds: 3900,
    badges: BADGES.map((badge) => ({ id: badge.id, earned: badge.id === 'first-clue' })),
  }
  const md = boardToMarkdown({ cases: CASES, notes: [NOTE], progress, email: 'ada@example.com', date: '2026-10-22' })
  expect(md).toContain('# Glitch Detective board\n\nExported 2026-10-22 · ada@example.com')
  expect(md).toContain('**Level 2 · Junior Detective** · 145 XP · 3-day streak · 1h 05m studied')
  expect(md).toContain('Badges: First clue')
  expect(md).toContain('## New (0)\n\n_Nothing here._')
  expect(md).toContain('## Training (1)\n\n### TypeError: boom')
  expect(md).toContain('**Your code**\n\n```javascript\na.b.c\n```')
  expect(md).toContain('## Solved (1)\n\n### IndexError: out')
  expect(md).toContain('## Notes\n\n### Undefined again\n\n#### Pattern')
  // The solved case had no code, so no empty code block.
  expect(md.split('**Your code**')).toHaveLength(2)
})

it('keeps code with backticks inside its fence', () => {
  const tricky = { ...CASES[0], code: 'x = ```' }
  const md = boardToMarkdown({ cases: [tricky], notes: [], progress: null, date: '2026-10-22' })
  expect(md).toContain('````javascript\nx = ```\n````')
})

it('makes safe file names', () => {
  expect(slug('Undefined: again & again!')).toBe('undefined-again-again')
  expect(slug('***')).toBe('untitled')
})
