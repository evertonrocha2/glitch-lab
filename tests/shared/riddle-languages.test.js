// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { errorProblem, giveawayIn } from '../../api/_lib/riddle/clues.js'
import {
  ATTRIBUTES,
  DOMAINS,
  EXECUTION,
  LABELS,
  LANGUAGES,
  languageById,
  MEMORY,
  PARADIGMS,
  searchLanguages,
  STRENGTH,
  SYNTAX,
  TYPING,
} from '../../shared/riddle/languages.js'
import { SAMPLES } from '../../shared/riddle/samples.js'

const ids = LANGUAGES.map((item) => item.id)

describe('the Glitchdle dataset', () => {
  it('has about 35 well-known languages with unique ids and names', () => {
    expect(LANGUAGES.length).toBeGreaterThanOrEqual(35)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(LANGUAGES.map((item) => item.name.toLowerCase())).size).toBe(ids.length)
    for (const name of ['JavaScript', 'Python', 'Rust', 'COBOL', 'Prolog', 'SQL', 'Bash', 'Objective-C']) {
      expect(LANGUAGES.map((item) => item.name)).toContain(name)
    }
  })

  it('uses only known values for every attribute', () => {
    for (const item of LANGUAGES) {
      expect(item.paradigms.length, item.id).toBeGreaterThan(0)
      expect(item.paradigms.every((value) => PARADIGMS.includes(value)), item.id).toBe(true)
      expect(new Set(item.paradigms).size, item.id).toBe(item.paradigms.length)
      expect(TYPING, item.id).toContain(item.typing)
      expect(STRENGTH, item.id).toContain(item.strength)
      expect(EXECUTION, item.id).toContain(item.execution)
      expect(MEMORY, item.id).toContain(item.memory)
      expect(item.domains.length, item.id).toBeGreaterThan(0)
      expect(item.domains.every((value) => DOMAINS.includes(value)), item.id).toBe(true)
      expect(SYNTAX, item.id).toContain(item.syntax)
      expect(Number.isInteger(item.year) && item.year >= 1950 && item.year <= 2025, item.id).toBe(true)
      expect(item.extension, item.id).toMatch(/^\.[A-Za-z0-9]+$/)
      expect(Array.isArray(item.aliases), item.id).toBe(true)
    }
  })

  it('labels every value and uses each one somewhere', () => {
    for (const value of [...PARADIGMS, ...TYPING, ...STRENGTH, ...EXECUTION, ...MEMORY, ...DOMAINS, ...SYNTAX]) {
      expect(LABELS[value], value).toEqual(expect.any(String))
    }
    const used = (key) => new Set(LANGUAGES.flatMap((item) => item[key]))
    for (const [key, values] of [
      ['typing', TYPING],
      ['execution', EXECUTION],
      ['memory', MEMORY],
      ['syntax', SYNTAX],
      ['paradigms', PARADIGMS],
    ]) {
      expect([...used(key)].sort(), key).toEqual([...values].sort())
    }
  })

  it('tells every language apart by its Classic attributes', () => {
    const rows = LANGUAGES.map((item) => JSON.stringify(ATTRIBUTES.map(({ key }) => item[key])))
    expect(new Set(rows).size).toBe(rows.length)
  })

  it('keeps a few classifications people check first', () => {
    expect(languageById('rust')).toMatchObject({ memory: 'ownership', execution: 'compiled', typing: 'static' })
    expect(languageById('python')).toMatchObject({ typing: 'dynamic', strength: 'strong', syntax: 'python-like' })
    expect(languageById('javascript')).toMatchObject({ typing: 'dynamic', strength: 'weak', year: 1995 })
    expect(languageById('typescript')).toMatchObject({ execution: 'transpiled', year: 2012 })
    expect(languageById('swift').memory).toBe('arc')
    expect(languageById('clojure').syntax).toBe('lisp')
    expect(languageById('haskell').paradigms).toEqual(['functional'])
    expect(languageById('prolog').paradigms).toContain('logic')
    expect(languageById('nope')).toBeNull()
  })

  it('has 2+ error samples and 2+ snippets of 5-10 lines for every language, and nothing else', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...ids].sort())
    for (const item of LANGUAGES) {
      const { errors, snippets } = SAMPLES[item.id]
      expect(errors.length, item.id).toBeGreaterThanOrEqual(2)
      expect(snippets.length, item.id).toBeGreaterThanOrEqual(2)
      for (const snippet of snippets) {
        const lines = snippet.split('\n')
        expect(lines.length, `${item.id}: ${lines[0]}`).toBeGreaterThanOrEqual(5)
        expect(lines.length, `${item.id}: ${lines[0]}`).toBeLessThanOrEqual(10)
      }
    }
  })

  it('never names the language (or its extension or tools) in an error or snippet', () => {
    for (const item of LANGUAGES) {
      for (const text of SAMPLES[item.id].errors) expect(errorProblem(text, item), `${item.id}: ${text}`).toBeNull()
      for (const text of SAMPLES[item.id].snippets) expect(giveawayIn(text, item), `${item.id}: ${text.split('\n')[0]}`).toBeNull()
    }
  })

  it('has no em dashes anywhere', () => {
    expect(JSON.stringify(LANGUAGES)).not.toContain('\u2014')
    expect(JSON.stringify(SAMPLES)).not.toContain('\u2014')
  })
})

describe('giveaways', () => {
  const python = languageById('python')
  it('catches the name in any case, with digits around it', () => {
    expect(giveawayIn('python3: command failed', python)).toBe('Python')
    expect(giveawayIn('Raised by PYTHON itself', python)).toBe('Python')
    expect(giveawayIn('File "main.py", line 3', python)).toBe('.py')
    expect(giveawayIn('pip install failed', python)).toBe('pip')
  })

  it('only counts short names with their capitals', () => {
    const go = languageById('go')
    expect(giveawayIn('let us go there', go)).toBeNull()
    expect(giveawayIn('Go panicked', go)).toBe('Go')
    expect(giveawayIn('go: module not found', go)).toBe('go:')
    expect(giveawayIn('x = r + 1', languageById('r'))).toBeNull()
  })

  it('does not see a name inside another word', () => {
    expect(giveawayIn('scalar value expected', languageById('scala'))).toBeNull()
    expect(giveawayIn('minimal example', languageById('nim'))).toBeNull()
  })

  it("flags other languages' names too", () => {
    expect(giveawayIn('unlike Java, this fails', languageById('kotlin'))).toBe('Java')
  })

  it('caps error length and lines', () => {
    expect(errorProblem('x', python)).toBe('too short')
    expect(errorProblem('E'.repeat(300), python)).toBe('too long')
    expect(errorProblem('a\nb\nc\nd\ne\nf\ng and more', python)).toBe('too many lines')
    expect(errorProblem('```\nKeyError\n```', python)).toBe('not plain text')
  })
})

describe('searching languages', () => {
  it('finds by name, alias or part of a name, prefix matches first', () => {
    expect(searchLanguages('ja').map((item) => item.id).slice(0, 2)).toEqual(['java', 'javascript'])
    expect(searchLanguages('golang').map((item) => item.id)).toEqual(['go'])
    expect(searchLanguages('c#').map((item) => item.id)).toContain('csharp')
    expect(searchLanguages('script').map((item) => item.id)).toEqual(expect.arrayContaining(['javascript', 'typescript', 'coffeescript']))
    expect(searchLanguages('')).toHaveLength(LANGUAGES.length)
    expect(searchLanguages('zzzz')).toEqual([])
  })
})

it('puts the closest match first for short searches', () => {
  expect(searchLanguages('ts')[0].id).toBe('typescript')
  expect(searchLanguages('f')[0].name.startsWith('F')).toBe(true)
  expect(searchLanguages('c')[0].id).toBe('c')
})
