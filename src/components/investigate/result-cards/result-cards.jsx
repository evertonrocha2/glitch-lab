import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelCard from '../../ui/pixel-card/pixel-card.jsx'
import Reveal from '../../ui/reveal/reveal.jsx'

const codeClass =
  'whitespace-pre-wrap wrap-break-word border-2 border-ink bg-mist p-4 font-mono text-sm leading-relaxed text-ink'

// question: a card from a doubt chat, so "what happened" is the summary, "why" is how the idea
// works, and there is no fix to reveal.
export default function ResultCards({ analysis, question = false }) {
  const t = useT()
  const { explicacao, causa, correcao, exercicio, pistas, local } = analysis

  return (
    <div className="mt-10 space-y-6">
      {(pistas?.length > 0 || local) && (
        <PixelCard as="section" tone="secondary" className="p-6">
          <h2 className="flex items-center gap-2 font-pixel text-xl font-bold text-ink">
            <span aria-hidden="true" className="grid size-6 place-items-center border-2 border-ink bg-secondary font-label text-[10px] text-white">
              ?
            </span>
            {t('board.result.clues')}
          </h2>
          {pistas?.length > 0 && (
            <ol className="mt-4 space-y-2">
              {pistas.map((clue, index) => (
                <li key={clue} className="flex gap-3 leading-relaxed text-ink">
                  <span aria-hidden="true" className="mt-0.5 font-label text-xs text-secondary">
                    #{index + 1}
                  </span>
                  <span>{clue}</span>
                </li>
              ))}
            </ol>
          )}
          {local && (
            <p className="mt-4 border-2 border-dashed border-secondary/50 bg-secondary-soft px-3 py-2 text-sm text-ink">
              <span className="font-label text-[10px] text-secondary">{t('board.result.likelySpot')}</span>{' '}
              <span className="font-mono text-sm">{local}</span>
            </p>
          )}
        </PixelCard>
      )}

      <PixelCard as="section" tone="muted" className="p-6">
        <h2 className="font-pixel text-xl font-bold text-ink">{question ? t('question.result.inShort') : t('board.result.whatHappened')}</h2>
        <p className="mt-3 leading-relaxed text-ink">{explicacao}</p>
      </PixelCard>

      <PixelCard as="section" className="bg-primary-soft p-6">
        <h2 className="font-pixel text-xl font-bold text-ink">
          <span className="bg-primary px-1.5 text-white">{question ? t('question.result.howLead') : t('board.result.whyLead')}</span>{' '}
          {question ? t('question.result.howTail') : t('board.result.whyTail')}
        </h2>
        <p className={`mt-3 leading-relaxed text-ink ${question ? 'whitespace-pre-wrap wrap-break-word' : ''}`}>{causa}</p>
        {correcao && (
          <Reveal label={t('board.result.fix')} className="text-primary">
            <pre className={codeClass}>{correcao}</pre>
          </Reveal>
        )}
      </PixelCard>

      <PixelCard as="section" tone="secondary" className="bg-secondary-soft p-6">
        <h2 className="font-pixel text-xl font-bold text-secondary">{t('board.result.practice')}</h2>
        <pre className={`mt-3 ${codeClass}`}>{exercicio.enunciado}</pre>
        <Reveal label={t('board.result.answer')} className="text-secondary">
          <pre className={codeClass}>{exercicio.resposta}</pre>
        </Reveal>
      </PixelCard>
    </div>
  )
}
