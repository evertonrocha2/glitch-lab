import { expect, it } from 'vitest'
import { BADGES } from '../../shared/badges.js'
import { boardToMarkdown, noteToMarkdown, slug } from './export-markdown.js'
import { translate } from './i18n/I18nProvider.jsx'

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
    // To-dos in a row make one tight list.
    '- [x] Use ?.\n- [ ] Second pass',
    '> **Case:** TypeError: boom\n> Reading undefined · javascript · Training (1/2)',
    '> **Case:** (no longer on the board)',
  ]
  expect(noteToMarkdown(NOTE, CASES)).toBe(`${blocks.join('\n\n')}\n`)
})

it('writes every rich block as real Markdown', () => {
  const note = {
    title: 'Rich',
    blocks: [
      { id: 'h2', type: 'heading', text: 'Sub', level: 2 },
      { id: 'h3', type: 'heading', text: 'Small', level: 3 },
      { id: 't', type: 'text', text: 'Some **bold** and `code` 🔥' },
      { id: 'b1', type: 'bullet', text: 'one' },
      { id: 'b2', type: 'bullet', text: 'nested', indent: 1 },
      { id: 'n1', type: 'numbered', text: 'first' },
      { id: 'n2', type: 'numbered', text: 'second' },
      { id: 'q', type: 'quote', text: 'line one\nline two' },
      { id: 'c', type: 'code', text: 'const a = "```"\nif (a) {\n  go()\n}', language: 'javascript' },
      { id: 'p', type: 'code', text: 'plain', language: '' },
      { id: 'd', type: 'divider' },
      { id: 'o', type: 'callout', text: 'Read the docs', tone: 'tip', emoji: '💡' },
    ],
  }
  const parts = [
    '# Rich',
    '### Sub',
    '#### Small',
    'Some **bold** and `code` 🔥',
    '- one\n   - nested\n1. first\n2. second',
    '> line one\n> line two',
    '````javascript\nconst a = "```"\nif (a) {\n  go()\n}\n````',
    '```\nplain\n```',
    '---',
    '> 💡 Read the docs',
  ]
  expect(noteToMarkdown(note, [])).toBe(`${parts.join('\n\n')}\n`)
})

it('puts a Tags line under the title, and none when there are no tags', () => {
  const note = { title: 'Loops', tags: ['loops', 'c#', 'laço'], blocks: [{ id: 'b1', type: 'text', text: 'for and while' }] }
  expect(noteToMarkdown(note, [])).toBe('# Loops\n\nTags: loops, c#, laço\n\nfor and while\n')
  expect(noteToMarkdown({ ...note, tags: [] }, [])).toBe('# Loops\n\nfor and while\n')
  expect(noteToMarkdown(note, [], 1, (key, vars) => translate('pt-BR', key, vars))).toContain('Tags: loops, c#, laço')
})

it('writes the board by column, with progress and notes', () => {
  const progress = {
    level: 2,
    title: 'Apprentice',
    xp: 145,
    streak: 3,
    totalSeconds: 3900,
    badges: BADGES.map((badge) => ({ id: badge.id, earned: badge.id === 'first-clue' })),
  }
  const md = boardToMarkdown({ cases: CASES, notes: [NOTE], progress, email: 'ada@example.com', date: '2026-10-22' })
  expect(md).toContain('# Glitch Lab board\n\nExported 2026-10-22 · ada@example.com')
  expect(md).toContain('**Level 2 · Apprentice** · 145 XP · 3-day streak · 1h 05m studied')
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

it('writes the board in Portuguese when given a Portuguese t', () => {
  const t = (key, vars) => translate('pt-BR', key, vars)
  const progress = { level: 2, title: 'Apprentice', xp: 145, streak: 3, totalSeconds: 3900, badges: [{ id: 'first-clue', earned: true }] }
  const md = boardToMarkdown({ cases: CASES, notes: [NOTE], progress, date: '2026-10-22', t })
  expect(md).toContain('# Board do Glitch Lab\n\nExportado em 2026-10-22')
  expect(md).toContain('**Nível 2 · Aprendiz** · 145 XP · 3 dias de sequência · 1h 05m de estudo')
  expect(md).toContain('Medalhas: Primeira pista')
  expect(md).toContain('## Novo (0)\n\n_Nada aqui._')
  expect(md).toContain('## Treinando (1)')
  expect(md).toContain('**Seu código**')
  expect(md).toContain('**Por que quebrou.** No name yet.')
  expect(md).toContain('## Notas')
  expect(md).toContain('> **Caso:** TypeError: boom\n> Lendo undefined · javascript · Treinando (1/2)')
  expect(md).toContain('> **Caso:** (não está mais no board)')
})

it('makes safe file names', () => {
  expect(slug('Undefined: again & again!')).toBe('undefined-again-again')
  expect(slug('***')).toBe('untitled')
})

const QUESTION = {
  id: 'q1',
  kind: 'question',
  status: 'new',
  passedCount: 0,
  error: '',
  code: '',
  question: 'Why does my loop skip the last item?',
  topic: 'range end',
  title: 'range stops before its end',
  recap: 'Asked why the loop skips the last item.',
  concept: 'off-by-one',
  language: 'python',
  analysis: { explicacao: 'range(n) stops at n - 1.', causa: 'The end is left out.', correcao: '', exercicio: { enunciado: 'Print 1 to 5.', resposta: 'range(1, 6)' } },
}

it('writes a question card with its question, recap, summary and exercise, and no fix', () => {
  const md = boardToMarkdown({ cases: [QUESTION], notes: [{ id: 'n2', title: 'Ranges', blocks: [{ id: 'b1', type: 'case', caseId: 'q1' }] }], date: '2026-10-23' })
  expect(md).toContain('### range stops before its end')
  expect(md).toContain('*Question · range end · Off by one · python · New (0/2)*')
  expect(md).toContain('**Question.** Why does my loop skip the last item?')
  expect(md).toContain('**From the chat.** Asked why the loop skips the last item.')
  expect(md).toContain('**In short.** range(n) stops at n - 1.')
  expect(md).toContain('**How it works.** The end is left out.')
  expect(md).toContain('Print 1 to 5.')
  expect(md).not.toContain('**Fix**')
  expect(md).toContain('> **Case:** range stops before its end')
  const pt = boardToMarkdown({ cases: [QUESTION], notes: [], date: '2026-10-23', t: (key, vars) => translate('pt-BR', key, vars) })
  expect(pt).toContain('**Dúvida.** Why does my loop skip the last item?')
  expect(pt).toContain('*Dúvida · range end ·')
})
