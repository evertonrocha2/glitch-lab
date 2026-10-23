// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { shareText } from '../../shared/riddle/share.js'
import { translate } from '../../src/lib/i18n/I18nProvider.jsx'

const NAMES = {
  en: { classic: 'Classic', error: 'Error', snippet: 'Snippet', frameworks: 'Frameworks', databases: 'Databases' },
  'pt-BR': { classic: 'Clássico', error: 'Erro', snippet: 'Trecho', frameworks: 'Frameworks', databases: 'Bancos de dados' },
}
const P = '\u{1F7EA}'
const B = '\u{1F7E8}'
const W = '⬜'
const row = (text) => [...text].map((char) => ({ p: 'match', b: 'partial', w: 'miss' })[char])
// 11 Classic guesses, the last one right.
const ROWS = [...Array(7).fill(row('wwwwwwww')), row('bwpppbww'), row('wpwwwwpw'), row('wwpwpbww'), row('pppppppp')]
const sample = (locale, fields = {}) =>
  shareText({
    t: (key, vars) => translate(locale, key, vars),
    name: (slot) => NAMES[locale][slot],
    number: 2,
    date: locale === 'en' ? 'Oct 23' : '23/10',
    boards: {
      classic: { solved: true, over: true, guesses: 11 },
      error: { solved: true, over: true, guesses: 1 },
      snippet: { solved: false, over: true, guesses: 30 },
      frameworks: { solved: false, over: false, guesses: 2 },
      databases: { solved: false, over: false, guesses: 0 },
    },
    rows: ROWS,
    streak: 3,
    host: 'glitch-lab-app.vercel.app',
    ...fields,
  })

const GRID = [`${B}${W}${P}${P}${P}${B}${W}${W}`, `${W}${P}${W}${W}${W}${W}${P}${W}`, `${W}${W}${P}${W}${P}${B}${W}${W}`, P.repeat(8)]

describe('the share text', () => {
  it('reads in Brazilian Portuguese', () => {
    expect(sample('pt-BR')).toBe(
      [
        '\u{1F50D} Glitchdle #2 (23/10)',
        '',
        '\u{1F9E9} Clássico: acertei em 11 palpites',
        '⚠️ Erro: acertei em 1 palpite',
        '✂️ Trecho: não acertei',
        '\u{1F9F1} Frameworks: ainda tentando (2 palpites)',
        '\u{1F5C4}️ Bancos de dados: não joguei',
        '',
        ...GRID,
        '(+7 palpites antes)',
        '',
        '\u{1F525} 3 dias seguidos',
        'Consegue fazer melhor? glitch-lab-app.vercel.app/glitchdle',
      ].join('\n'),
    )
  })

  it('reads in English', () => {
    expect(sample('en')).toBe(
      [
        '\u{1F50D} Glitchdle #2 (Oct 23)',
        '',
        '\u{1F9E9} Classic: solved in 11 guesses',
        '⚠️ Error: solved in 1 guess',
        '✂️ Snippet: not solved',
        '\u{1F9F1} Frameworks: still trying (2 guesses)',
        '\u{1F5C4}️ Databases: not played',
        '',
        ...GRID,
        '(+7 earlier guesses)',
        '',
        '\u{1F525} 3-day streak',
        'Can you do better? glitch-lab-app.vercel.app/glitchdle',
      ].join('\n'),
    )
  })

  it('leaves out a short streak and an empty grid, and says one guess in the singular', () => {
    const short = sample('pt-BR', { streak: 1, rows: [row('pppppppp')] })
    expect(short).not.toContain('\u{1F525}')
    expect(short).not.toContain('antes')
    expect(sample('en', { rows: [] }).split('\n')).toHaveLength(10)
    expect(sample('pt-BR', { rows: ROWS.slice(-5) })).toContain('(+1 palpite antes)')
    expect(sample('en', { rows: ROWS.slice(-5) })).toContain('(+1 earlier guess)')
  })

  it('has no em dashes or middle dots', () => {
    for (const locale of ['en', 'pt-BR']) expect(sample(locale)).not.toMatch(/\u2014|·/)
  })
})
