import { expect, it } from 'vitest'
import { canvasScale, exportDate, noteFileName, pageSlices, pdfGeometry } from './exportNote.js'

it('names each export after the note title', () => {
  expect(noteFileName('Undefined: again!', 'md')).toBe('undefined-again.md')
  expect(noteFileName('Undefined: again!', 'png')).toBe('undefined-again.png')
  expect(noteFileName('', 'pdf')).toBe('untitled.pdf')
})

it('writes the export date in plain words', () => {
  expect(exportDate(new Date(2026, 9, 22))).toBe('Oct 22, 2026')
})

it("writes the export date in the reader's language", () => {
  expect(exportDate(new Date(2026, 9, 22), 'pt-BR')).toBe('22 de out. de 2026')
})

it('fits an 800px sheet across A4 with margins', () => {
  const page = pdfGeometry({ widthPx: 800, marginMm: 10 })
  expect(page.contentWidthMm).toBe(190)
  expect(page.mmPerPx).toBeCloseTo(0.2375)
  // 277mm of usable height is 1166 sheet pixels.
  expect(page.pageHeightPx).toBe(1166)
})

it('keeps a short sheet on one page', () => {
  expect(pageSlices(900, 1000, [100, 400])).toEqual([{ top: 0, height: 900 }])
})

it('cuts between blocks, never through one, when a block edge is close enough', () => {
  // Blocks end at 300, 700 and 1050: 1050 is past the first page, so the page ends at 700.
  expect(pageSlices(1500, 1000, [300, 700, 1050, 1500])).toEqual([
    { top: 0, height: 700 },
    { top: 700, height: 800 },
  ])
})

it('cuts straight through when no block edge fills enough of the page', () => {
  // The only edge is at 100: a page that short would waste most of the sheet.
  expect(pageSlices(2500, 1000, [100])).toEqual([
    { top: 0, height: 1000 },
    { top: 1000, height: 1000 },
    { top: 2000, height: 500 },
  ])
})

it('ignores edges that are not whole pixels or sit outside the sheet', () => {
  expect(pageSlices(1200, 1000, [-5, 640.6, 5000])).toEqual([
    { top: 0, height: 641 },
    { top: 641, height: 559 },
  ])
})

it('keeps tall sheets inside the browser canvas limits', () => {
  expect(canvasScale(800, 1000)).toBe(2)
  const tall = canvasScale(800, 12_000)
  expect(800 * tall * 12_000 * tall).toBeLessThanOrEqual(16_000_000 * 1.0001)
  expect(12_000 * tall).toBeLessThanOrEqual(16_000)
  expect(canvasScale(800, 40_000) * 40_000).toBeLessThanOrEqual(16_000)
})
