import Reveal from './Reveal.jsx'
import Squiggle from './Squiggle.jsx'

const codeClass =
  'whitespace-pre-wrap break-words rounded-xl border border-line bg-white p-4 font-mono text-[13px] leading-relaxed text-ink'

const cardClass = {
  plain: 'border-line bg-white',
  why: 'border-primary/20 bg-primary-soft',
  practice: 'border-secondary/20 bg-secondary-soft',
}

function Card({ title, tone, children }) {
  return (
    <section className={`rounded-2xl border p-6 sm:p-7 ${cardClass[tone]}`}>
      {title}
      <div className="mt-3 leading-relaxed text-ink">{children}</div>
    </section>
  )
}

export default function ResultCards({ analysis }) {
  const { explicacao, causa, correcao, exercicio } = analysis

  return (
    <div className="mt-8 space-y-4">
      <Card tone="plain" title={<h2 className="font-display text-xl font-bold text-ink">What happened</h2>}>
        <p>{explicacao}</p>
      </Card>
      <Card
        tone="why"
        title={
          <h2 className="font-display text-xl font-bold text-primary">
            <span className="relative inline-block">
              Why it broke
              <Squiggle animated className="absolute -bottom-1.5 left-0 h-2.5 w-full" />
            </span>
          </h2>
        }
      >
        <p>{causa}</p>
        <Reveal label="fix" className="text-primary">
          <pre className={codeClass}>{correcao}</pre>
        </Reveal>
      </Card>
      <Card tone="practice" title={<h2 className="font-display text-xl font-bold text-secondary">Practice</h2>}>
        <pre className={codeClass}>{exercicio.enunciado}</pre>
        <Reveal label="answer" className="text-secondary">
          <pre className={codeClass}>{exercicio.resposta}</pre>
        </Reveal>
      </Card>
    </div>
  )
}
