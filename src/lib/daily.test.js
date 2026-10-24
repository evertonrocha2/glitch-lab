import { expect, it } from 'vitest'
import { formatCountdown, formatSolveTime, languageName } from './daily.js'

it('counts down in hours, minutes and seconds, or days and hours when far off', () => {
  expect(formatCountdown(0)).toBe('0:00:00')
  expect(formatCountdown(-5000)).toBe('0:00:00')
  expect(formatCountdown((11 * 3600 + 59 * 60 + 30) * 1000)).toBe('11:59:30')
  expect(formatCountdown((3 * 86_400 + 12 * 3600 + 5) * 1000)).toBe('3d 12h')
})

it('shows solve times from seconds up to hours', () => {
  expect(formatSolveTime(45)).toBe('45s')
  expect(formatSolveTime(303)).toBe('5m 03s')
  expect(formatSolveTime(3900)).toBe('1h 05m')
})

it('names languages the way people write them', () => {
  expect(languageName('javascript')).toBe('JavaScript')
  expect(languageName('typescript')).toBe('TypeScript')
  expect(languageName('python')).toBe('Python')
  expect(languageName('csharp')).toBe('C#')
  expect(languageName('cpp')).toBe('C++')
  expect(languageName('rust')).toBe('Rust')
  expect(languageName('cobol')).toBe('cobol')
})
