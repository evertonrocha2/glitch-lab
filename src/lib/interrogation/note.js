import { NOTE_LIMITS } from '../../../shared/limits.js'
import { timeline } from '../../../shared/interrogation.js'
import { isQuestion } from '../../../shared/question.js'
import { caseHeading } from '../case-info.js'
import { stepKey } from './step-key.js'
import { newBlock } from '../notes/blocks.js'

const fit = (text) => (text.length > NOTE_LIMITS.text ? `${text.slice(0, NOTE_LIMITS.text - 3)}...` : text)

// A finished (or partial) interrogation as a note: the case, then each passed step as a heading with
// the student's answer and the coach's word on it. t is useT().
export function interrogationNote({ kase, interrogation, t }) {
  const blocks = [newBlock('case', { caseId: kase.id })]
  const rows = timeline(interrogation).filter((row) => row.status === 'passed')
  for (const row of rows) {
    const title = t(stepKey(row.id, 'title', isQuestion(kase)))
    blocks.push(newBlock('heading', { text: `${row.index + 1}. ${title}` }))
    blocks.push(newBlock('text', { text: fit(t('interrogation.note.answer', { text: row.answer })) }))
    if (row.feedback) blocks.push(newBlock('text', { text: fit(t('interrogation.note.coach', { text: row.feedback })) }))
  }
  const title = t('interrogation.note.title', { type: caseHeading(kase).type }).slice(0, NOTE_LIMITS.title)
  return { title, blocks }
}
