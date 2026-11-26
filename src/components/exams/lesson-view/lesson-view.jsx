import { parseQuestionText } from '../../../../shared/exams/question-text.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../ui/pixel-card/pixel-card.jsx'
import QuestionText from '../question-text/question-text.jsx'

const LETTERS = ['A', 'B', 'C', 'D', 'E']

// One line of lesson text: the **bold** and _italic_ QuestionText knows, as text nodes. No images.
function Inline({ text }) {
  const parts = parseQuestionText(text)
    .filter((block) => block.type === 'paragraph')
    .flatMap((block, at) => (at > 0 ? [{ text: ' ' }, ...block.parts] : block.parts))
  return parts.map((part, at) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: pieces of one fixed line
    <span key={at} className={`${part.bold ? 'font-semibold' : ''} ${part.italic ? 'italic' : ''}`.trim() || undefined}>
      {part.text}
    </span>
  ))
}

function Part({ id, title, children }) {
  return (
    <section aria-labelledby={id} className="border-t-2 border-line pt-5 first:border-t-0 first:pt-0">
      <h2 id={id} className="font-pixel text-lg font-bold text-ink sm:text-xl">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Bullets({ items, marker = 'bg-primary' }) {
  return (
    <ul className="space-y-2">
      {items.map((item, at) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: items of one fixed lesson
        <li key={at} className="flex gap-2.5 leading-relaxed">
          <span aria-hidden="true" className={`mt-2 size-2 shrink-0 ${marker}`} />
          <span className="min-w-0 break-words">
            <Inline text={item} />
          </span>
        </li>
      ))}
    </ul>
  )
}

const Letter = ({ letter, className = '' }) => (
  <span className={`flex size-7 shrink-0 items-center justify-center border-2 border-ink font-label text-[11px] ${className}`}>{letter}</span>
)

// A topic's lesson, read before the questions: how the ENEM asks it, the core ideas, one real
// question solved step by step and the traps. Ends on a button to the questions.
export default function LessonView({ lesson, onPractice }) {
  const t = useT()
  const example = lesson.exemplo
  const ids = (part) => `lesson-${lesson.topic}-${part}`
  return (
    <PixelCard as="article" className="p-4 sm:p-6">
      <div className="space-y-6 text-ink">
        <Part id={ids('cai')} title={t('exams.lesson.cai')}>
          <p className="break-words leading-relaxed">
            <Inline text={lesson.cai} />
          </p>
        </Part>

        <Part id={ids('ideias')} title={t('exams.lesson.ideias')}>
          <Bullets items={lesson.ideias} />
        </Part>

        <Part id={ids('exemplo')} title={t('exams.lesson.exemplo')}>
          <p className="font-label text-[10px] text-secondary">{t('exams.lesson.exemploSource', { year: example.year, number: example.number })}</p>
          <div className="mt-3 border-l-4 border-line bg-mist p-3 sm:p-4">
            <QuestionText text={example.enunciado} />
            <ul aria-label={t('exams.lesson.alternatives')} className="mt-4 space-y-2">
              {LETTERS.map((letter) => (
                <li key={letter} className="flex items-start gap-3">
                  <Letter letter={letter} className="bg-white text-ink" />
                  <span className="min-w-0 flex-1 break-words pt-0.5">
                    <Inline text={example.alternativas[letter]} />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <h3 id={ids('passos')} className="mt-5 font-label text-xs text-secondary">
            {t('exams.lesson.steps')}
          </h3>
          <ol aria-labelledby={ids('passos')} className="mt-2 space-y-2">
            {example.passos.map((step, at) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: steps of one fixed lesson
              <li key={at} className="flex items-start gap-3 leading-relaxed">
                <span aria-hidden="true" className="mt-0.5 w-5 shrink-0 text-right font-label text-xs text-muted">
                  {at + 1}.
                </span>
                <span className="min-w-0 flex-1 break-words">
                  <Inline text={step} />
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-4 flex items-start gap-3 border-2 border-primary bg-primary-soft p-3">
            <span className="shrink-0 pt-1 font-label text-xs text-primary">{t('exams.lesson.resposta', { letter: example.resposta })}</span>{' '}
            <span className="min-w-0 flex-1 break-words font-semibold">
              <Inline text={example.alternativas[example.resposta]} />
            </span>
          </p>
        </Part>

        <Part id={ids('pegadinhas')} title={t('exams.lesson.pegadinhas')}>
          <Bullets items={lesson.pegadinhas} marker="bg-secondary" />
        </Part>
      </div>

      <PixelButton onClick={onPractice} className="mt-8 w-full px-5 py-3 sm:w-auto">
        {t('exams.lesson.practice')}
      </PixelButton>
    </PixelCard>
  )
}
