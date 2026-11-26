import { describe, expect, it } from 'vitest'
import { studyHref } from './study-cta.js'

describe('studyHref', () => {
  it("sends to the daily puzzle while today's daily isn't done", () => {
    expect(studyHref({ locale: 'pt-BR', doneToday: { daily: false, hunt: false } })).toBe('/daily')
    expect(studyHref({ locale: 'en', doneToday: {} })).toBe('/daily')
    expect(studyHref({ locale: 'en' })).toBe('/daily')
  })

  it("then to the line hunt while today's hunt isn't done", () => {
    expect(studyHref({ locale: 'pt-BR', doneToday: { daily: true, hunt: false } })).toBe('/hunt')
  })

  it('then to ENEM practice in Portuguese', () => {
    expect(studyHref({ locale: 'pt-BR', doneToday: { daily: true, hunt: true } })).toBe('/exams/enem')
  })

  it('then to the board in English', () => {
    expect(studyHref({ locale: 'en', doneToday: { daily: true, hunt: true } })).toBe('/board')
  })

  // Review Focus 5: ENEM only appears in the pt-BR UI.
  it('never links to ENEM in English, whatever is done', () => {
    for (const daily of [true, false]) {
      for (const hunt of [true, false]) {
        expect(studyHref({ locale: 'en', doneToday: { daily, hunt } })).not.toMatch(/enem/)
      }
    }
  })
})
