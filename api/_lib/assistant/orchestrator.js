import { validateActions } from './actions.js'
import { composeAnswers } from './compose.js'
import { loadContext } from './context.js'
import { routeQuestion } from './router.js'
import { buildSpecialistPrompt, parseSpecialistAnswer, SPECIALIST_SCHEMA, specialistSystem } from './specialists.js'
import { stepText } from './steps.js'

// Router -> context loaders -> specialists in parallel -> merge -> action check.
// `generate` is generateJson (injected so the pieces stay testable). Throws the first specialist's
// error only when none of them answered. locale: the reader's language, for the replies, the
// default action labels and the steps (routing itself stays the same in every language).
export async function runAssistant({ store, userId, messages, page, generate, locale = 'en' }) {
  const text = stepText(locale)
  const { route, fellBack } = await routeQuestion(generate, { messages, page })
  const steps = [fellBack ? text.fellBack : text.routing]

  const results = await Promise.allSettled(
    route.map(async (pick) => {
      const data = await loadContext(pick.name, store, userId, { page, needs: pick.needs })
      const partner = route.find((other) => other.name !== pick.name)?.name
      const answer = await generate({
        system: specialistSystem(pick.name, locale),
        prompt: buildSpecialistPrompt({ messages, page, focus: pick.focus, data, partner }),
        schema: SPECIALIST_SCHEMA,
      })
      return { name: pick.name, ...parseSpecialistAnswer(answer) }
    }),
  )

  const answered = []
  results.forEach((result, index) => {
    const { name } = route[index]
    steps.push(result.status === 'fulfilled' ? text.working(name) : text.failed(name))
    if (result.status === 'fulfilled') answered.push(result.value)
  })
  if (!answered.length) throw results[0].reason
  if (answered.length > 1) steps.push(text.merging)

  const composed = composeAnswers(answered)
  return {
    reply: composed.reply,
    parts: composed.parts,
    actions: await validateActions(store, userId, composed.actions, locale),
    agents: answered.map((answer) => answer.name),
    steps,
  }
}
