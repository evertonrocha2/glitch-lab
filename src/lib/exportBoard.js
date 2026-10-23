import { createElement } from 'react'
import BoardSheet from '../components/board/board-sheet/board-sheet.jsx'
import { localDay } from './day.js'
import { boardToMarkdown, downloadText } from './exportMarkdown.js'
import { exportSheetImage, exportSheetPdf } from './exportNote.js'
import { DEFAULT_LOCALE, I18nProvider, translate } from './i18n/I18nProvider.jsx'
import { dateIn } from './i18n/format.js'

// One name for all three files, dated on the student's own clock.
export const boardFileName = (format, date = new Date()) => `glitch-lab-board-${localDay(date)}.${format}`

// Every export is written in `locale`, the reader's language (English when none is given).
export function exportBoardMarkdown({ cases, notes, progress, email, locale = DEFAULT_LOCALE }) {
  const t = (key, vars) => translate(locale, key, vars)
  downloadText(boardFileName('md'), boardToMarkdown({ cases, notes, progress, email, date: localDay(), t }))
}

// The picture leaves the email out: it's made to be shared. It renders outside the app, so it gets its own language provider.
const boardSheet = ({ cases, notes, progress, locale = DEFAULT_LOCALE }) =>
  createElement(I18nProvider, { locale }, createElement(BoardSheet, { cases, notes, progress, date: dateIn(locale, new Date()) }))

export const exportBoardImage = (board) => exportSheetImage(boardSheet(board), boardFileName('png'))

export const exportBoardPdf = (board) =>
  exportSheetPdf(boardSheet(board), boardFileName('pdf'), translate(board.locale ?? DEFAULT_LOCALE, 'board.export.pdfTitle'))
