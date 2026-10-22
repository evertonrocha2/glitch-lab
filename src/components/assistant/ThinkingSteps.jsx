import { useEffect, useMemo, useState } from 'react'
import { pickSpecialists, SPECIALISTS } from '../../../shared/assistant.js'
import PixelBug from '../pixel/PixelBug.jsx'
import DetectiveAvatar from './DetectiveAvatar.jsx'

const STEP_MS = 2500

// The server answers in one go, so the plan here is a best guess (the same keyword routing the
// server falls back to). The real trace comes with the reply.
export function plannedSteps(question, page) {
  const agents = pickSpecialists(question, page).map((id) => SPECIALISTS.find((item) => item.id === id))
  return ['Routing your question', ...agents.map((agent) => `${agent.name} ${agent.doing}`), 'Writing your answer']
}

export default function ThinkingSteps({ question, page }) {
  const steps = useMemo(() => plannedSteps(question, page), [question, page])
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setActive((current) => Math.min(current + 1, steps.length - 1)), STEP_MS)
    return () => clearInterval(timer)
  }, [steps])

  return (
    <div className="flex items-start gap-2.5">
      <DetectiveAvatar />
      <div role="status" className="min-w-0 flex-1 border-2 border-ink bg-white p-3 shadow-pixel">
        <div className="flex items-center gap-2.5">
          <PixelBug className="h-5 w-auto shrink-0 motion-safe:animate-walk" />
          <span className="font-label text-[10px] text-primary">Working on it</span>
        </div>
        <ol className="mt-2.5 space-y-1.5 text-sm">
          {steps.map((step, index) => (
            <li key={step} className={`flex items-center gap-2 ${index > active ? 'text-muted/60' : 'text-ink'}`}>
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 border border-ink ${
                  index < active ? 'bg-primary' : index === active ? 'bg-secondary motion-safe:animate-blink' : 'bg-white'
                }`}
              />
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted">The free AI can take a minute.</p>
      </div>
    </div>
  )
}
