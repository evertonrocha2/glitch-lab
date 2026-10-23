import { validateActions } from './actions.js'
import { createReplyFilter } from './answer-stream.js'
import { composeAnswers } from './compose.js'
import { loadContext } from './context.js'
import { routeQuestion } from './router.js'
import { buildSpecialistPrompt, noEmDash, parseSpecialistAnswer, parseStreamedAnswer, SPECIALIST_SCHEMA, specialistSystem } from './specialists.js'
import { stepText } from './steps.js'

// The answer both endpoints return: merged replies, who answered, checked actions and the steps.
// Throws the first specialist's error only when none of them answered.
async function finish({ store, userId, route, results, fellBack, locale }) {
  const text = stepText(locale)
  const steps = [fellBack ? text.fellBack : text.routing]
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

const specialistPrompt = (pick, route, { messages, page, data }) =>
  buildSpecialistPrompt({ messages, page, focus: pick.focus, data, partner: route.find((other) => other.name !== pick.name)?.name })

// Router -> context loaders -> specialists in parallel -> merge -> action check.
// `generate` is generateJson (injected so the pieces stay testable). locale: the reader's language,
// for the replies, the default action labels and the steps (routing itself stays the same in every language).
export async function runAssistant({ store, userId, messages, page, generate, locale = 'en' }) {
  const { route, fellBack } = await routeQuestion(generate, { messages, page })
  const results = await Promise.allSettled(
    route.map(async (pick) => {
      const data = await loadContext(pick.name, store, userId, { page, needs: pick.needs })
      const answer = await generate({
        system: specialistSystem(pick.name, locale),
        prompt: specialistPrompt(pick, route, { messages, page, data }),
        schema: SPECIALIST_SCHEMA,
      })
      return { name: pick.name, ...parseSpecialistAnswer(answer) }
    }),
  )
  return finish({ store, userId, route, results, fellBack, locale })
}

// The same, streamed. emit(event, data) sends `step` and `delta` events as the work goes on, and
// the result is what runAssistant returns. `stream` is streamText. allowExtra() counts the AI call
// of each specialist past the first before it starts, and says no once today's limit is used up.
// Two specialists write at the same time, but the student reads one at a time: the second one's
// text waits until the first is done, then catches up.
export async function runAssistantStream({ store, userId, messages, page, generate, stream, locale = 'en', emit, signal, allowExtra = async () => true }) {
  const text = stepText(locale)
  emit('step', { kind: 'routing', text: text.routing })
  const routed = await routeQuestion(generate, { messages, page, signal })
  signal?.throwIfAborted()
  if (routed.fellBack) emit('step', { kind: 'fellBack', text: text.fellBack })

  const route = [routed.route[0]]
  for (const pick of routed.route.slice(1)) if (await allowExtra()) route.push(pick)
  const agents = route.map((pick) => pick.name)
  emit('step', { kind: 'specialists', agents, text: text.handing(agents) })

  const slots = route.map(() => ({ waiting: [], finished: false }))
  let live = 0
  const catchUp = () => {
    while (live < slots.length) {
      for (const piece of slots[live].waiting) emit('delta', { agent: agents[live], text: piece })
      slots[live].waiting = []
      if (!slots[live].finished) return
      live++
    }
  }
  const write = (index, piece) => {
    if (index === live) emit('delta', { agent: agents[index], text: piece })
    else slots[index].waiting.push(piece)
  }
  const done = (index) => {
    slots[index].finished = true
    if (index === live) catchUp()
  }

  const results = await Promise.allSettled(
    route.map(async (pick, index) => {
      try {
        emit('step', { kind: 'context', agent: pick.name, text: text.working(pick.name) })
        const data = await loadContext(pick.name, store, userId, { page, needs: pick.needs })
        const filter = createReplyFilter((piece) => write(index, noEmDash(piece)))
        const full = await stream({
          system: specialistSystem(pick.name, locale, { stream: true }),
          prompt: specialistPrompt(pick, route, { messages, page, data }),
          signal,
          onDelta: (piece) => filter.push(piece),
        })
        filter.end()
        return { name: pick.name, ...parseStreamedAnswer(full) }
      } catch (err) {
        emit('step', { kind: 'failed', agent: pick.name, text: text.failed(pick.name) })
        throw err
      } finally {
        done(index)
      }
    }),
  )
  signal?.throwIfAborted()
  if (results.filter((result) => result.status === 'fulfilled').length > 1) emit('step', { kind: 'merging', text: text.merging })
  return finish({ store, userId, route, results, fellBack: routed.fellBack, locale })
}
