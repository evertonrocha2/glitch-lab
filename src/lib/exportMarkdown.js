import { badgeById } from '../../shared/badges.js'
import { conceptLabel } from '../../shared/concepts.js'
import { formatDuration } from './day.js'

const COLUMNS = [
  { status: 'new', title: 'New' },
  { status: 'training', title: 'Training' },
  { status: 'solved', title: 'Solved' },
]
const STATUS = { new: 'New', training: 'Training', solved: 'Solved' }

// A fence longer than any run of backticks inside, so code with ``` in it can't break out.
function fence(code, language = '') {
  const longest = Math.max(2, ...(code.match(/`+/g) ?? []).map((run) => run.length))
  const marks = '`'.repeat(longest + 1)
  return `${marks}${language}\n${code}\n${marks}`
}

const firstLine = (text) => text.split('\n')[0]
const caseSummary = (item) => `${conceptLabel(item.concept)} · ${item.language} · ${STATUS[item.status]} (${Math.min(item.passedCount, 2)}/2)`

function blockToMarkdown(block, casesById, depth) {
  switch (block.type) {
    case 'heading':
      return `${'#'.repeat(depth + 1)} ${block.text}`
    case 'todo':
      return `- [${block.done ? 'x' : ' '}] ${block.text}`
    case 'case': {
      const item = casesById.get(block.caseId)
      return item ? `> **Case:** ${firstLine(item.error)}\n> ${caseSummary(item)}` : '> **Case:** (no longer on the board)'
    }
    default:
      return block.text
  }
}

// depth is the heading level of the note title: 1 alone, 2 inside the board export.
export function noteToMarkdown(note, cases, depth = 1) {
  const casesById = new Map(cases.map((item) => [item.id, item]))
  const parts = [`${'#'.repeat(depth)} ${note.title || 'Untitled'}`]
  for (const block of note.blocks) {
    if (block.type === 'text' && block.text.trim() === '') continue
    parts.push(blockToMarkdown(block, casesById, depth))
  }
  return `${parts.join('\n\n')}\n`
}

function caseToMarkdown(item) {
  const { explicacao, causa, correcao, exercicio, pistas, local } = item.analysis
  const parts = [`### ${firstLine(item.error)}`, `*${caseSummary(item)}*`]
  if (item.error.includes('\n')) parts.push(fence(item.error))
  if (item.context) parts.push(`**You were trying to:** ${item.context}`)
  if (pistas?.length) parts.push(`**Clues**\n\n${pistas.map((clue, index) => `${index + 1}. ${clue}`).join('\n')}`)
  if (local) parts.push(`**Likely spot:** ${local}`)
  if (item.code) parts.push('**Your code**', fence(item.code, item.language))
  for (const file of item.files ?? []) parts.push(`**${file.path}**`, fence(file.content))
  parts.push(`**What happened.** ${explicacao}`, `**Why it broke.** ${causa}`, '**Fix**', fence(correcao))
  parts.push('**Practice**', fence(exercicio.enunciado), '**Answer**', fence(exercicio.resposta))
  return parts.join('\n\n')
}

function progressLine(progress) {
  if (!progress) return null
  const earned = progress.badges.filter((badge) => badge.earned).map((badge) => badgeById(badge.id)?.name ?? badge.id)
  return [
    `**Level ${progress.level} · ${progress.title}** · ${progress.xp} XP · ${progress.streak}-day streak · ${formatDuration(progress.totalSeconds)} studied`,
    `Badges: ${earned.length ? earned.join(', ') : 'none yet'}`,
  ].join('\n\n')
}

// The whole board as one Markdown file. Notion, Obsidian and GitHub all read it.
export function boardToMarkdown({ cases, notes, progress, email, date }) {
  const parts = ['# Glitch Detective board', `Exported ${date}${email ? ` · ${email}` : ''}`]
  const summary = progressLine(progress)
  if (summary) parts.push(summary)
  for (const column of COLUMNS) {
    const items = cases.filter((item) => item.status === column.status)
    parts.push(`## ${column.title} (${items.length})`)
    if (items.length === 0) parts.push('_Nothing here._')
    for (const item of items) parts.push(caseToMarkdown(item))
  }
  if (notes.length) {
    parts.push('## Notes')
    for (const note of notes) parts.push(noteToMarkdown(note, cases, 3).trimEnd())
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
