import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { isQuestion } from '../../../../shared/question.js'
import { caseHeading } from '../../../lib/case-info.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useFormat } from '../../../lib/i18n/format.js'
import { useLabels } from '../../../lib/i18n/labels.js'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import ResultCards from '../../investigate/result-cards/result-cards.jsx'
import { ProgressBlocks } from '../case-card/case-card.jsx'
import QuestionBadge from '../question-badge/question-badge.jsx'

const STATUS = {
  new: { style: 'border border-ink bg-white text-ink' },
  training: { style: 'bg-secondary text-white' },
  solved: { style: 'bg-primary text-white' },
}

// A side panel to study one case, with the way into the gym at the bottom.
// children: extra sections the page adds under the gym card (the board puts the interrogation there).
export default function CaseDrawer({ item, onClose, onTrain, training, notes = [], onWriteNote, writing = false, children }) {
  const t = useT()
  const labels = useLabels()
  const { timeAgo } = useFormat()
  const panel = useRef(null)
  const { type, message } = caseHeading(item)
  // A question card (from a doubt chat): the question and a recap of the chat instead of an error.
  const question = isQuestion(item)
  const status = STATUS[item.status]
  const solved = item.status === 'solved'
  const passed = Math.min(item.passedCount, 2)

  // Focus moves into the panel and comes back to whatever opened it (usually the card).
  useEffect(() => {
    const opener = document.activeElement
    panel.current?.focus()
    return () => opener?.focus?.()
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Clicking the dimmed page closes the panel; keyboard users have Escape and the Close button. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('board.drawer.closePanel')}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40"
      />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-title"
        tabIndex={-1}
        className="relative h-full w-full max-w-2xl overflow-y-auto border-l-2 border-ink bg-mist focus-visible:outline-none"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b-2 border-ink bg-white px-6 py-3 sm:px-8">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className={`px-1.5 py-0.5 text-xs font-semibold ${status.style}`}>{labels.status(item.status)}</span>
            {question && <QuestionBadge topic={item.topic} />}
            <span className="bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary">{labels.concept(item.concept)}</span>
            {!(question && item.language === 'unknown') && <span className="border border-line bg-white px-1.5 py-0.5 font-mono text-xs text-muted">{item.language}</span>}
            <span className="text-xs text-muted">{t('board.drawer.opened', { time: timeAgo(item.createdAt) })}</span>
          </p>
          <PixelButton variant="ghost" onClick={onClose} className="shrink-0 px-3 py-2">
            {t('board.drawer.close')}
          </PixelButton>
        </div>

        <div className="p-6 sm:p-8">
          <h2 id="case-title">
            <span className="block wrap-break-word font-pixel text-3xl font-bold text-ink">{type}</span>
            <span className="sr-only">:</span>{' '}
            {question ? (
              <span className="sr-only">{message}</span>
            ) : (
              <span className="mt-2 block wrap-break-word font-mono text-sm leading-relaxed text-ink/80">{message}</span>
            )}
          </h2>

          {question && (
            <div className="mt-5 space-y-3">
              <div className="border-2 border-ink bg-white p-4">
                <p className="font-label text-[10px] text-secondary">{t('question.drawer.asked')}</p>
                <p className="mt-1.5 whitespace-pre-wrap wrap-break-word leading-relaxed text-ink">{item.question}</p>
              </div>
              {item.recap && (
                <p className="border-2 border-dashed border-secondary/50 bg-secondary-soft px-3 py-2 text-sm text-ink">
                  <span className="font-label text-[10px] text-secondary">{t('question.drawer.recap')}</span>{' '}
                  <span className="whitespace-pre-line">{item.recap}</span>
                </p>
              )}
            </div>
          )}

          {item.context && (
            <p className="mt-5 text-ink">
              <span className="font-label text-[10px] text-muted">{t('board.drawer.tryingTo')}</span> {item.context}
            </p>
          )}

          {item.code && (
            <details className="mt-6 border-2 border-ink bg-white">
              <summary className="cursor-pointer px-4 py-2.5 font-label text-xs text-ink">{t('board.drawer.yourCode')}</summary>
              <pre className="overflow-x-auto border-t-2 border-ink bg-mist p-4 font-mono text-sm leading-relaxed text-ink">{item.code}</pre>
            </details>
          )}

          {item.files?.map((file) => (
            <details key={file.path} className="mt-3 border-2 border-ink bg-white">
              <summary className="cursor-pointer truncate px-4 py-2.5 font-mono text-xs text-ink">{file.path}</summary>
              <pre className="overflow-x-auto border-t-2 border-ink bg-mist p-4 font-mono text-sm leading-relaxed text-ink">{file.content}</pre>
            </details>
          ))}

          <ResultCards analysis={item.analysis} question={question} />

          <div className="mt-10 border-2 border-ink bg-secondary-soft p-5 shadow-pixel-secondary">
            <div className="flex items-center justify-between gap-3">
              <p className="font-label text-xs text-secondary">{t('board.drawer.gym')}</p>
              <span className="flex items-center gap-2 text-sm text-ink">
                <ProgressBlocks passed={passed} />
                {t('board.drawer.passed', { passed })}
              </span>
            </div>
            <p className="mt-3 text-ink">
              {solved ? t('board.drawer.solvedText') : t('board.drawer.trainText')}
            </p>
            <PixelButton variant="secondary" onClick={() => onTrain(item)} disabled={training || !onTrain} className="mt-4">
              {training ? t('board.drawer.preparing') : solved ? t('board.drawer.practiceAgain') : t('board.drawer.train')}
            </PixelButton>
          </div>

          {children}

          <section aria-labelledby="case-notes-title" className="mt-8 border-2 border-ink bg-white p-5 shadow-pixel">
            <h3 id="case-notes-title" className="font-label text-xs text-primary">
              {t('board.drawer.notes')}
            </h3>
            {notes.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {notes.map((note) => (
                  <li key={note.id}>
                    <Link to={`/notes/${note.id}`} className="font-semibold text-ink underline decoration-2 underline-offset-4 hover:text-primary">
                      {note.title || t('board.drawer.untitled')}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-ink">{t('board.drawer.notesEmpty')}</p>
            )}
            <PixelButton variant="ghost" onClick={() => onWriteNote(item)} disabled={writing || !onWriteNote} className="mt-4">
              {writing ? t('board.drawer.openingNote') : t('board.drawer.writeNote')}
            </PixelButton>
          </section>
        </div>
      </aside>
    </div>
  )
}
