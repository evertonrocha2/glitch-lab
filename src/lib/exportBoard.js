import { createElement } from 'react'
import BoardSheet from '../components/board/BoardSheet.jsx'
import { localDay } from './day.js'
import { boardToMarkdown, downloadText } from './exportMarkdown.js'
import { exportDate, exportSheetImage, exportSheetPdf } from './exportNote.js'

// One name for all three files, dated on the student's own clock.
export const boardFileName = (format, date = new Date()) => `glitch-detective-board-${localDay(date)}.${format}`

export function exportBoardMarkdown({ cases, notes, progress, email }) {
  downloadText(boardFileName('md'), boardToMarkdown({ cases, notes, progress, email, date: localDay() }))
}

// The picture leaves the email out: it's made to be shared.
const boardSheet = ({ cases, notes, progress }) => createElement(BoardSheet, { cases, notes, progress, date: exportDate() })

export const exportBoardImage = (board) => exportSheetImage(boardSheet(board), boardFileName('png'))

export const exportBoardPdf = (board) => exportSheetPdf(boardSheet(board), boardFileName('pdf'), 'Glitch Detective case board')
