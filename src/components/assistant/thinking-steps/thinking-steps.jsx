import { useEffect, useMemo, useState } from 'react'
import { pickSpecialists } from '../../../../shared/assistant.js'
import { translate, useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelBug from '../../ui/pixel-bug/pixel-bug.jsx'
import LabAvatar from '../lab-avatar/lab-avatar.jsx'
import { routingStep, workingStep, writingStep } from '../names.js'

const STEP_MS = 2500

// The server answers in one go, so the plan here is a best guess (the same keyword routing the
// server falls back to). The real trace comes with the reply.
// `t` defaults to English, for callers outside a provider.
export function plannedSteps(question, page, t) {
  const say = t ?? ((key, vars) => translate('en', key, vars))
  return [routingStep(say), ...pickSpecialists(question, page).map((id) => workingStep(say, id)), writingStep(say)]
}

export default function ThinkingSteps({ question, page }) {
  const t = useT()
  const steps = useMemo(() => plannedSteps(question, page, t), [question, page, t])
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setActive((current) => Math.min(current + 1, steps.length - 1)), STEP_MS)
    return () => clearInterval(timer)
  }, [steps])

  return (
    <div className="flex items-start gap-2.5">
      <LabAvatar />
      <div role="status" className="min-w-0 flex-1 border-2 border-ink bg-white p-3 shadow-pixel">
        <div className="flex items-center gap-2.5">
          <PixelBug className="h-5 w-auto shrink-0 motion-safe:animate-walk" />
          <span className="font-label text-[10px] text-primary">{t('app.assistant.working')}</span>
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
      </div>
    </div>
  )
}
