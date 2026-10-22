import { SPECIALISTS, specialistName } from '../../../shared/assistant.js'
import { validateActions } from './actions.js'
import { composeAnswers } from './compose.js'
import { loadContext } from './context.js'
import { routeQuestion } from './router.js'
import { buildSpecialistPrompt, parseSpecialistAnswer, SPECIALIST_SCHEMA, SPECIALIST_SYSTEMS } from './specialists.js'

const working = (name) => `${specialistName(name)} ${SPECIALISTS.find((item) => item.id === name).doing}`

// Router -> context loaders -> specialists in parallel -> merge -> action check.
// `generate` is generateJson (injected so the pieces stay testable). Throws the first specialist's
// error only when none of them answered.
export async function runAssistant({ store, userId, messages, page, generate }) {
  const { route, fellBack } = await routeQuestion(generate, { messages, page })
  const steps = [fellBack ? 'Picking specialists by keywords (the router did not answer)' : 'Routing your question']

  const results = await Promise.allSettled(
    route.map(async (pick) => {
      const data = await loadContext(pick.name, store, userId, { page, needs: pick.needs })
      const partner = route.find((other) => other.name !== pick.name)?.name
      const answer = await generate({
        system: SPECIALIST_SYSTEMS[pick.name],
        prompt: buildSpecialistPrompt({ messages, page, focus: pick.focus, data, partner }),
        schema: SPECIALIST_SCHEMA,
      })
      return { name: pick.name, ...parseSpecialistAnswer(answer) }
    }),
  )

  const answered = []
  results.forEach((result, index) => {
    const { name } = route[index]
    steps.push(result.status === 'fulfilled' ? working(name) : `${specialistName(name)} could not answer this time`)
    if (result.status === 'fulfilled') answered.push(result.value)
  })
  if (!answered.length) throw results[0].reason
  if (answered.length > 1) steps.push('Putting the answers together')

  const composed = composeAnswers(answered)
  return {
    reply: composed.reply,
    parts: composed.parts,
    actions: await validateActions(store, userId, composed.actions),
    agents: answered.map((answer) => answer.name),
    steps,
  }
}
