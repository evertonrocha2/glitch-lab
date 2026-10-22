import PixelCard from './pixel/PixelCard.jsx'
import Reveal from './Reveal.jsx'

const codeClass =
  'whitespace-pre-wrap wrap-break-word border-2 border-ink bg-mist p-4 font-mono text-sm leading-relaxed text-ink'

export default function ResultCards({ analysis }) {
  const { explicacao, causa, correcao, exercicio, pistas, local } = analysis

  return (
    <div className="mt-10 space-y-6">
      {(pistas?.length > 0 || local) && (
        <PixelCard as="section" tone="secondary" className="p-6">
          <h2 className="flex items-center gap-2 font-pixel text-xl font-bold text-ink">
            <span aria-hidden="true" className="grid size-6 place-items-center border-2 border-ink bg-secondary font-label text-[10px] text-white">
              ?
            </span>
            Clues from the error
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
              <span className="font-label text-[10px] text-secondary">Likely spot</span>{' '}
              <span className="font-mono text-sm">{local}</span>
            </p>
          )}
        </PixelCard>
      )}

      <PixelCard as="section" tone="muted" className="p-6">
        <h2 className="font-pixel text-xl font-bold text-ink">What happened</h2>
        <p className="mt-3 leading-relaxed text-ink">{explicacao}</p>
      </PixelCard>

      <PixelCard as="section" className="bg-primary-soft p-6">
        <h2 className="font-pixel text-xl font-bold text-ink">
          <span className="bg-primary px-1.5 text-white">Why</span> it broke
        </h2>
        <p className="mt-3 leading-relaxed text-ink">{causa}</p>
        <Reveal label="fix" className="text-primary">
          <pre className={codeClass}>{correcao}</pre>
        </Reveal>
      </PixelCard>

      <PixelCard as="section" tone="secondary" className="bg-secondary-soft p-6">
        <h2 className="font-pixel text-xl font-bold text-secondary">Practice</h2>
        <pre className={`mt-3 ${codeClass}`}>{exercicio.enunciado}</pre>
        <Reveal label="answer" className="text-secondary">
          <pre className={codeClass}>{exercicio.resposta}</pre>
        </Reveal>
      </PixelCard>
    </div>
  )
}
