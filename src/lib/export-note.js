import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import NoteSheet from '../components/notes/note-sheet/note-sheet.jsx'
import { downloadText, noteToMarkdown, slug } from './export-markdown.js'
import { currentLocale, I18nProvider, translate } from './i18n/I18nProvider.jsx'
import { dateIn } from './i18n/format.js'

// Twice the screen pixels: crisp pixel fonts on retina screens and in print.
const SCALE = 2
// Browsers refuse canvases past a size (iOS Safari: about 16.7M pixels, most: 16384px a side).
const MAX_CANVAS_PIXELS = 16_000_000
const MAX_CANVAS_SIDE = 16_000
// A4 portrait, in millimeters.
const A4 = { width: 210, height: 297 }
const MARGIN_MM = 12
// A page that would end before this share of its height cuts through a block instead.
const MIN_FILL = 0.25
// Every face the sheet uses, so none is still loading when it's drawn.
const FONTS = ['400 16px "Geist Pixel"', '400 16px Geist', '600 16px Geist', '400 16px "Geist Mono"']

export const noteFileName = (title, format) => `${slug(title)}.${format}`

// The sharpest scale (up to 2x) that keeps a widthxheight sheet inside every browser's canvas limit.
export function canvasScale(width, height) {
  return Math.min(SCALE, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)), MAX_CANVAS_SIDE / height, MAX_CANVAS_SIDE / width)
}

// Today in the reader's language: "Oct 22, 2026", "22 de out. de 2026".
export const exportDate = (date = new Date(), locale = currentLocale()) => dateIn(locale, date)

// How a sheet `widthPx` wide fits across an A4 page inside its margins.
export function pdfGeometry({ widthPx, marginMm = MARGIN_MM }) {
  const contentWidthMm = A4.width - 2 * marginMm
  const mmPerPx = contentWidthMm / widthPx
  return { contentWidthMm, mmPerPx, pageHeightPx: Math.floor((A4.height - 2 * marginMm) / mmPerPx) }
}

// Splits a tall sheet into pages. Each page ends at the last block edge that fits, so text and
// case cards are not cut in half; a hard cut only when no edge would fill enough of the page.
export function pageSlices(totalHeight, pageHeight, breaks = []) {
  const edges = breaks.map(Math.round).filter((edge) => edge > 0 && edge < totalHeight)
  const slices = []
  let top = 0
  while (top < totalHeight) {
    const limit = top + pageHeight
    if (limit >= totalHeight) {
      slices.push({ top, height: totalHeight - top })
      break
    }
    const fits = edges.filter((edge) => edge >= top + pageHeight * MIN_FILL && edge <= limit)
    const cut = fits.length ? Math.max(...fits) : limit
    slices.push({ top, height: cut - top })
    top = cut
  }
  return slices
}

export function exportNoteMarkdown({ note, cases }) {
  downloadText(noteFileName(note.title, 'md'), noteToMarkdown(note, cases, 1, (key, vars) => translate(currentLocale(), key, vars)))
}

export function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// Draws a sheet component out of sight, hands its element to `use`, then takes it away again.
// The sheet is drawn in its own React root, so it gets the reader's language here.
export async function withSheet(sheetElement, use) {
  const holder = document.createElement('div')
  holder.setAttribute('aria-hidden', 'true')
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none'
  document.body.append(holder)
  const root = createRoot(holder)
  try {
    flushSync(() => root.render(createElement(I18nProvider, { locale: currentLocale() }, sheetElement)))
    await Promise.all(FONTS.map((font) => document.fonts.load(font).catch(() => {})))
    await document.fonts.ready
    return await use(holder.firstElementChild)
  } finally {
    root.unmount()
    holder.remove()
  }
}

// The web fonts are served by the site itself (src/fonts.css), so the library can read their
// @font-face rules and inline the files. If that ever fails the picture still comes out, just in
// the fallback fonts.
// { canvas, scale }: the scale drops below 2x only for sheets too tall for one canvas.
async function drawSheet(sheet) {
  const { domToCanvas } = await import('modern-screenshot')
  const scale = canvasScale(sheet.offsetWidth, sheet.offsetHeight)
  return { canvas: await domToCanvas(sheet, { scale, backgroundColor: '#ffffff', timeout: 15000 }), scale }
}

const noteSheet = ({ note, cases }) => createElement(NoteSheet, { note, cases, date: exportDate() })

// Any sheet as one PNG.
export async function exportSheetImage(sheetElement, fileName) {
  const blob = await withSheet(sheetElement, async (sheet) => {
    const { canvas } = await drawSheet(sheet)
    return new Promise((resolve, reject) => canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('No image.'))), 'image/png'))
  })
  downloadBlob(fileName, blob)
}

export const exportNoteImage = ({ note, cases }) => exportSheetImage(noteSheet({ note, cases }), noteFileName(note.title, 'png'))

export const exportNotePdf = ({ note, cases }) => exportSheetPdf(noteSheet({ note, cases }), noteFileName(note.title, 'pdf'), note.title || translate(currentLocale(), 'notes.untitled'))

// Any sheet as A4 pages. Elements marked data-sheet-block are never cut in half.
export async function exportSheetPdf(sheetElement, fileName, title) {
  const [{ jsPDF }, drawn] = await Promise.all([
    import('jspdf'),
    withSheet(sheetElement, async (sheet) => {
      const top = sheet.getBoundingClientRect().top
      const breaks = [...sheet.querySelectorAll('[data-sheet-block]')].map((block) => block.getBoundingClientRect().bottom - top)
      return { ...(await drawSheet(sheet)), width: sheet.offsetWidth, height: sheet.offsetHeight, breaks }
    }),
  ])
  const { canvas, scale, width, height, breaks } = drawn
  const page = pdfGeometry({ widthPx: width })
  const slices = pageSlices(height, page.pageHeightPx, breaks)
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  pdf.setProperties({ title, creator: 'Glitch Lab' })

  slices.forEach((slice, index) => {
    if (index > 0) pdf.addPage()
    const part = document.createElement('canvas')
    part.width = canvas.width
    part.height = Math.round(slice.height * scale)
    const context = part.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, part.width, part.height)
    context.drawImage(canvas, 0, Math.round(slice.top * scale), part.width, part.height, 0, 0, part.width, part.height)
    pdf.addImage(part, 'PNG', MARGIN_MM, MARGIN_MM, page.contentWidthMm, slice.height * page.mmPerPx, undefined, 'FAST')
    pdf.setFontSize(8)
    pdf.setTextColor(91, 95, 112)
    pdf.text(`${index + 1} / ${slices.length}`, A4.width - MARGIN_MM, A4.height - MARGIN_MM / 2, { align: 'right' })
  })
  downloadBlob(fileName, pdf.output('blob'))
}
