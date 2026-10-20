import Reveal from './Reveal.jsx'

const codeClass = 'whitespace-pre-wrap rounded-lg bg-zinc-950 p-3 font-mono text-sm text-zinc-200'

function Card({ title, children }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-semibold text-amber-400">{title}</h2>
      <div className="mt-2 text-zinc-300">{children}</div>
    </section>
  )
}

export default function ResultCards({ analysis }) {
  const { explicacao, causa, correcao, exercicio } = analysis

  return (
    <div className="mt-10 space-y-4">
      <Card title="What happened">
        <p>{explicacao}</p>
      </Card>
      <Card title="Why it broke">
        <p>{causa}</p>
        <Reveal label="fix">
          <pre className={codeClass}>{correcao}</pre>
        </Reveal>
      </Card>
      <Card title="Practice">
        <pre className={codeClass}>{exercicio.enunciado}</pre>
        <Reveal label="answer">
          <pre className={codeClass}>{exercicio.resposta}</pre>
        </Reveal>
      </Card>
    </div>
  )
}
