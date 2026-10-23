import { caseText, isQuestion } from '../../shared/question.js'
import { formatDuration } from './day.js'
import { translate } from './i18n/I18nProvider.jsx'
import { badgeName, conceptName, levelTitle, statusName } from './i18n/labels.js'

const COLUMNS = ['new', 'training', 'solved']
// Headings and labels follow `t` (from useT()); without one the file is written in English.
const ENGLISH = (key, vars) => translate('en', key, vars)

// A fence longer than any run of backticks inside, so code with ``` in it can't break out.
function fence(code, language = '') {
  const longest = Math.max(2, ...(code.match(/`+/g) ?? []).map((run) => run.length))
  const marks = '`'.repeat(longest + 1)
  return `${marks}${language}\n${code}\n${marks}`
}

const firstLine = (text) => text.split('\n')[0]
// The heading of a case: its error's first line, or a question card's title.
const caseTitle = (item) => (isQuestion(item) ? item.title || item.topic : firstLine(item.error))
// A question card's line names its badge and topic first.
const caseSummary = (item, t) =>
  `${isQuestion(item) ? `${t('question.badge')} · ${item.topic} · ` : ''}${conceptName(t, item.concept)} · ${item.language} · ${statusName(t, item.status)} (${Math.min(item.passedCount, 2)}/2)`

function blockToMarkdown(block, casesById, depth, t) {
  switch (block.type) {
    case 'heading':
      return `${'#'.repeat(depth + 1)} ${block.text}`
    case 'todo':
      return `- [${block.done ? 'x' : ' '}] ${block.text}`
    case 'case': {
      const item = casesById.get(block.caseId)
      return item ? `> **${t('board.md.case')}** ${caseTitle(item)}\n> ${caseSummary(item, t)}` : `> **${t('board.md.case')}** ${t('board.md.caseGone')}`
    }
    default:
      return block.text
  }
}

// depth is the heading level of the note title: 1 alone, 2 inside the board export.
export function noteToMarkdown(note, cases, depth = 1, t = ENGLISH) {
  const casesById = new Map(cases.map((item) => [item.id, item]))
  const parts = [`${'#'.repeat(depth)} ${note.title || t('board.md.untitled')}`]
  for (const block of note.blocks) {
    if (block.type === 'text' && block.text.trim() === '') continue
    parts.push(blockToMarkdown(block, casesById, depth, t))
  }
  return `${parts.join('\n\n')}\n`
}

// A question card: the question, a recap of the chat, the summary, how it works and the exercise.
function questionToMarkdown(item, t) {
  const { explicacao, causa, exercicio } = item.analysis
  const parts = [`### ${caseTitle(item)}`, `*${caseSummary(item, t)}*`, `**${t('question.md.question')}** ${caseText(item)}`]
  if (item.recap) parts.push(`**${t('question.md.recap')}** ${item.recap}`)
  if (item.code) parts.push(`**${t('board.md.yourCode')}**`, fence(item.code, item.language === 'unknown' ? '' : item.language))
  parts.push(`**${t('question.md.inShort')}** ${explicacao}`, `**${t('question.md.howItWorks')}** ${causa}`)
  parts.push(`**${t('board.md.practice')}**`, fence(exercicio.enunciado), `**${t('board.md.answer')}**`, fence(exercicio.resposta))
  return parts.join('\n\n')
}

function caseToMarkdown(item, t) {
  if (isQuestion(item)) return questionToMarkdown(item, t)
  const { explicacao, causa, correcao, exercicio, pistas, local } = item.analysis
  const parts = [`### ${firstLine(item.error)}`, `*${caseSummary(item, t)}*`]
  if (item.error.includes('\n')) parts.push(fence(item.error))
  if (item.context) parts.push(`**${t('board.md.tryingTo')}** ${item.context}`)
  if (pistas?.length) parts.push(`**${t('board.md.clues')}**\n\n${pistas.map((clue, index) => `${index + 1}. ${clue}`).join('\n')}`)
  if (local) parts.push(`**${t('board.md.likelySpot')}** ${local}`)
  if (item.code) parts.push(`**${t('board.md.yourCode')}**`, fence(item.code, item.language))
  for (const file of item.files ?? []) parts.push(`**${file.path}**`, fence(file.content))
  parts.push(`**${t('board.md.whatHappened')}** ${explicacao}`, `**${t('board.md.whyItBroke')}** ${causa}`, `**${t('board.md.fix')}**`, fence(correcao))
  parts.push(`**${t('board.md.practice')}**`, fence(exercicio.enunciado), `**${t('board.md.answer')}**`, fence(exercicio.resposta))
  return parts.join('\n\n')
}

function progressLine(progress, t) {
  if (!progress) return null
  const earned = progress.badges.filter((badge) => badge.earned).map((badge) => badgeName(t, badge.id))
  const level = t('board.md.level', { level: progress.level, title: levelTitle(t, progress.level) || progress.title })
  const streak = progress.streak === 0 ? t('board.md.streakZero') : t('board.md.streak', { count: progress.streak })
  return [
    `**${level}** · ${progress.xp} XP · ${streak} · ${t('board.md.studied', { time: formatDuration(progress.totalSeconds) })}`,
    t('board.md.badges', { list: earned.length ? earned.join(', ') : t('board.md.badgesNone') }),
  ].join('\n\n')
}

// The whole board as one Markdown file. Notion, Obsidian and GitHub all read it.
export function boardToMarkdown({ cases, notes, progress, email, date, t = ENGLISH }) {
  const parts = [`# ${t('board.md.title')}`, `${t('board.md.exported', { date })}${email ? ` · ${email}` : ''}`]
  const summary = progressLine(progress, t)
  if (summary) parts.push(summary)
  for (const status of COLUMNS) {
    const items = cases.filter((item) => item.status === status)
    parts.push(`## ${statusName(t, status)} (${items.length})`)
    if (items.length === 0) parts.push(`_${t('board.md.nothingHere')}_`)
    for (const item of items) parts.push(caseToMarkdown(item, t))
  }
  if (notes.length) {
    parts.push(`## ${t('board.md.notes')}`)
    for (const note of notes) parts.push(noteToMarkdown(note, cases, 3, t).trimEnd())
  }
  return `${parts.join('\n\n')}\n`
}

// Lowercase words joined by dashes, for file names.
export function slug(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'untitled'
  )
}

export function downloadText(fileName, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
