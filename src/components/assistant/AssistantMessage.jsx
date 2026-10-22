import { specialistName } from '../../../shared/assistant.js'
import PixelButton from '../pixel/PixelButton.jsx'
import DetectiveAvatar from './DetectiveAvatar.jsx'
import ReplyText from './ReplyText.jsx'

export function UserBubble({ message }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-line wrap-break-word border-2 border-ink bg-secondary-soft px-3 py-2 text-sm text-ink shadow-pixel-secondary">
        {message.content}
      </p>
    </div>
  )
}

// One reply: who answered, each specialist's part, the actions it offers, and how it was answered.
export function AssistantBubble({ message, onAction, busy }) {
  const agents = message.agents ?? []
  const parts = message.parts?.length ? message.parts : [{ agent: agents[0], reply: message.content }]
  const several = parts.length > 1

  return (
    <div className="flex items-start gap-2.5">
      <DetectiveAvatar />
      <div className="min-w-0 flex-1 border-2 border-ink bg-white p-3 shadow-pixel">
        {agents.length > 0 && <p className="font-label text-[10px] text-primary">Answered by {agents.map(specialistName).join(' + ')}</p>}
        <div className={`mt-1.5 ${several ? 'space-y-3' : ''}`}>
          {parts.map((part, index) => (
            <section key={index} className={several && index > 0 ? 'border-t-2 border-dashed border-line pt-3' : ''}>
              {several && <h3 className="mb-1 font-label text-[10px] text-secondary">{specialistName(part.agent)}</h3>}
              <ReplyText text={part.reply} label={specialistName(part.agent)} />
            </section>
          ))}
        </div>
        {message.actions?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actions.map((action) => (
              <PixelButton
                key={`${action.type}:${action.target}`}
                variant={action.type === 'train_case' || action.type === 'start_timer' ? 'primary' : 'secondary'}
                onClick={() => onAction(action)}
                disabled={busy}
                className="px-2.5 py-1.5 text-[10px]"
              >
                {action.label}
              </PixelButton>
            ))}
          </div>
        )}
        {message.steps?.length > 0 && (
          <details className="mt-3 text-xs text-muted">
            <summary className="cursor-pointer font-label text-[10px] hover:text-ink">How this was answered</summary>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
              {message.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </div>
  )
}
