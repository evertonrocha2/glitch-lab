import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import NoteSheet from '../components/notes/NoteSheet.jsx'
import { downloadText, noteToMarkdown, slug } from './exportMarkdown.js'

// Twice the screen pixels: crisp pixel fonts on retina screens and in print.
const SCALE = 2
// A4 portrait, in millimeters.
const A4 = { width: 210, height: 297 }
const MARGIN_MM = 12
// A page that would end before this share of its height cuts through a block instead.
const MIN_FILL = 0.25
// Every face the sheet uses, so none is still loading when it's drawn.
const FONTS = ['500 16px "Pixelify Sans"', '700 16px "Pixelify Sans"', '16px Silkscreen', '400 16px Geist', '600 16px Geist', '400 16px "Geist Mono"']

export const noteFileName = (title, format) => `${slug(title)}.${format}`

export const exportDate = (date = new Date()) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

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
  downloadText(noteFileName(note.title, 'md'), noteToMarkdown(note, cases))
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

// Draws the sheet out of sight, hands its element to `use`, then takes it away again.
async function withSheet({ note, cases }, use) {
  const holder = document.createElement('div')
  holder.setAttribute('aria-hidden', 'true')
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none'
  document.body.append(holder)
  const root = createRoot(holder)
  try {
    flushSync(() => root.render(createElement(NoteSheet, { note, cases, date: exportDate() })))
    await Promise.all(FONTS.map((font) => document.fonts.load(font).catch(() => {})))
    await document.fonts.ready
    return await use(holder.firstElementChild)
  } finally {
    root.unmount()
    holder.remove()
  }
}

// The web fonts come from Google Fonts. index.html loads that stylesheet with crossorigin, so the
// library can read its @font-face rules and inline the font files. If that ever fails the picture
// still comes out, just in the fallback fonts.
async function drawSheet(sheet) {
  const { domToCanvas } = await import('modern-screenshot')
  return domToCanvas(sheet, { scale: SCALE, backgroundColor: '#ffffff', timeout: 15000 })
}

export async function exportNoteImage({ note, cases }) {
  const blob = await withSheet({ note, cases }, async (sheet) => {
    const canvas = await drawSheet(sheet)
    return new Promise((resolve, reject) => canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('No image.'))), 'image/png'))
  })
  downloadBlob(noteFileName(note.title, 'png'), blob)
}

export async function exportNotePdf({ note, cases }) {
  const [{ jsPDF }, drawn] = await Promise.all([
    import('jspdf'),
    withSheet({ note, cases }, async (sheet) => {
      const top = sheet.getBoundingClientRect().top
      const breaks = [...sheet.querySelectorAll('[data-sheet-block]')].map((block) => block.getBoundingClientRect().bottom - top)
      return { canvas: await drawSheet(sheet), width: sheet.offsetWidth, height: sheet.offsetHeight, breaks }
    }),
  ])
  const { canvas, width, height, breaks } = drawn
  const page = pdfGeometry({ widthPx: width })
  const slices = pageSlices(height, page.pageHeightPx, breaks)
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  pdf.setProperties({ title: note.title || 'Untitled', creator: 'Glitch Detective' })

  slices.forEach((slice, index) => {
    if (index > 0) pdf.addPage()
    const part = document.createElement('canvas')
    part.width = canvas.width
    part.height = Math.round(slice.height * SCALE)
    const context = part.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, part.width, part.height)
    context.drawImage(canvas, 0, Math.round(slice.top * SCALE), part.width, part.height, 0, 0, part.width, part.height)
    pdf.addImage(part, 'PNG', MARGIN_MM, MARGIN_MM, page.contentWidthMm, slice.height * page.mmPerPx, undefined, 'FAST')
    pdf.setFontSize(8)
    pdf.setTextColor(91, 95, 112)
    pdf.text(`${index + 1} / ${slices.length}`, A4.width - MARGIN_MM, A4.height - MARGIN_MM / 2, { align: 'right' })
  })
  downloadBlob(noteFileName(note.title, 'pdf'), pdf.output('blob'))
}
