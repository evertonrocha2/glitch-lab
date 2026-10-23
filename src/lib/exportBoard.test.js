import { expect, it } from 'vitest'
import { boardFileName } from './exportBoard.js'

it('names every board export after the local day', () => {
  const day = new Date(2026, 9, 2, 23, 30)
  expect(boardFileName('md', day)).toBe('glitch-lab-board-2026-10-02.md')
  expect(boardFileName('png', day)).toBe('glitch-lab-board-2026-10-02.png')
  expect(boardFileName('pdf', day)).toBe('glitch-lab-board-2026-10-02.pdf')
})
