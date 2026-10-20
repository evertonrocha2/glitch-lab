import PixelCard from './pixel/PixelCard.jsx'
import Reveal from './Reveal.jsx'

const codeClass =
  'whitespace-pre-wrap break-words border-2 border-ink bg-mist p-4 font-mono text-[13px] leading-relaxed text-ink'

export default function ResultCards({ analysis }) {
  const { explicacao, causa, correcao, exercicio } = analysis

  return (
    <div className="mt-10 space-y-6">
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
