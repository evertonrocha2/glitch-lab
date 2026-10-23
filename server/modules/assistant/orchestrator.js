import { createBoundary } from '../../infra/ai/guard/fence.js'
import { guardText } from '../../infra/ai/guard/messages.js'
import { findLeak, secretLines } from '../../infra/ai/guard/output.js'
import { validateActions } from './actions.js'
import { createReplyFilter } from './answer-stream.js'
import { composeAnswers } from './compose.js'
import { loadContext } from './context.js'
import { routeQuestion } from './router.js'
import { buildSpecialistPrompt, noEmDash, parseSpecialistAnswer, parseStreamedAnswer, SPECIALIST_SCHEMA, specialistSystem } from './specialists.js'
import { stepText } from './steps.js'

// The answer when the guard answers instead of the specialists (off topic, a blocked attempt):
// the same shape as a real one, shown like a normal reply, with no actions. guard says why.
export function guardAnswer(kind, locale = 'en', steps = []) {
  const reply = guardText(kind, locale)
  return { reply, parts: [{ agent: 'guide', reply }], actions: [], agents: [], steps, guard: kind }
}

// The gym challenge open on the page: its reference solution and the hints not revealed yet. The
// gym coach never sees them; they are only here to catch a reply that lands on them anyway.
async function pageSecrets(store, userId, page) {
  if (!page?.challengeId) return {}
  const record = await store.getChallenge(userId, page.challengeId)
  if (!record) return {}
  const secret = await store.getChallengeSecret(record.id)
  return { lines: secretLines(secret?.solution, record.brokenCode), texts: record.hints.slice(record.hintsRevealed) }
}

// A reply that leaks the prompt, the fence or a secret becomes the safe message, without actions.
function guarded(answer, guard, locale) {
  if (answer.offTopic || !findLeak(answer.reply, guard)) return answer
  return { ...answer, reply: guardText('leak', locale), actions: [], leaked: true }
}

// The answer both endpoints return: merged replies, who answered, checked actions and the steps.
// Throws the first specialist's error only when none of them answered. Specialists that called the
// question off topic are left out; when all of them did, the guard answers.
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
  const onTopic = answered.filter((answer) => !answer.offTopic)
  if (!onTopic.length) return guardAnswer('off_topic', locale, steps)
  if (onTopic.length > 1) steps.push(text.merging)

  const composed = composeAnswers(onTopic)
  return {
    reply: composed.reply,
    parts: composed.parts,
    actions: await validateActions(store, userId, composed.actions, locale),
    agents: onTopic.map((answer) => answer.name),
    steps,
    ...(onTopic.some((answer) => answer.leaked) ? { guard: 'leak' } : {}),
  }
}

const specialistPrompt = (pick, route, { messages, page, data, boundary }) =>
  buildSpecialistPrompt({ messages, page, focus: pick.focus, data, boundary, partner: route.find((other) => other.name !== pick.name)?.name })

// Router -> context loaders -> specialists in parallel -> merge -> action check.
// `generate` is generateJson (injected so the pieces stay testable). locale: the reader's language,
// for the replies, the default action labels and the steps (routing itself stays the same in every language).
// One boundary token fences every prompt of the question.
export async function runAssistant({ store, userId, messages, page, generate, locale = 'en' }) {
  const boundary = createBoundary()
  const routed = await routeQuestion(generate, { messages, page, boundary })
  if (routed.offTopic) return guardAnswer('off_topic', locale, [stepText(locale).routing])
  const { route, fellBack } = routed
  const guard = { boundary, ...(await pageSecrets(store, userId, page)) }
  const results = await Promise.allSettled(
    route.map(async (pick) => {
      const data = await loadContext(pick.name, store, userId, { page, needs: pick.needs })
      const answer = await generate({
        system: specialistSystem(pick.name, locale, { boundary }),
        prompt: specialistPrompt(pick, route, { messages, page, data, boundary }),
        schema: SPECIALIST_SCHEMA,
      })
      return guarded({ name: pick.name, ...parseSpecialistAnswer(answer) }, guard, locale)
    }),
  )
  return finish({ store, userId, route, results, fellBack, locale })
}

// The same, streamed. emit(event, data) sends `step` and `delta` events as the work goes on, and
// the result is what runAssistant returns. `stream` is streamText. allowExtra() counts the AI call
// of each specialist past the first before it starts, and says no once today's limit is used up.
// Two specialists write at the same time, but the student reads one at a time: the second one's
// text waits until the first is done, then catches up. A part that starts leaking stops being
// sent right there; the final answer carries the safe text instead.
export async function runAssistantStream({ store, userId, messages, page, generate, stream, locale = 'en', emit, signal, allowExtra = async () => true }) {
  const text = stepText(locale)
  const boundary = createBoundary()
  emit('step', { kind: 'routing', text: text.routing })
  const routed = await routeQuestion(generate, { messages, page, signal, boundary })
  signal?.throwIfAborted()
  if (routed.offTopic) {
    const answer = guardAnswer('off_topic', locale, [text.routing])
    emit('delta', { agent: 'guide', text: answer.reply })
    return answer
  }
  if (routed.fellBack) emit('step', { kind: 'fellBack', text: text.fellBack })
  const guard = { boundary, ...(await pageSecrets(store, userId, page)) }

  const route = [routed.route[0]]
  for (const pick of routed.route.slice(1)) if (await allowExtra()) route.push(pick)
  const agents = route.map((pick) => pick.name)
  emit('step', { kind: 'specialists', agents, text: text.handing(agents) })

  const slots = route.map(() => ({ waiting: [], finished: false, shown: '', stopped: false }))
  let live = 0
  let wrote = false
  const send = (index, piece) => {
    wrote = true
    emit('delta', { agent: agents[index], text: piece })
  }
  const catchUp = () => {
    while (live < slots.length) {
      for (const piece of slots[live].waiting) send(live, piece)
      slots[live].waiting = []
      if (!slots[live].finished) return
      live++
    }
  }
  const write = (index, piece) => {
    const slot = slots[index]
    if (slot.stopped) return
    slot.shown += piece
    if (findLeak(slot.shown, guard)) {
      slot.stopped = true
      return
    }
    if (index === live) send(index, piece)
    else slot.waiting.push(piece)
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
          system: specialistSystem(pick.name, locale, { stream: true, boundary }),
          prompt: specialistPrompt(pick, route, { messages, page, data, boundary }),
          signal,
          onDelta: (piece) => filter.push(piece),
        })
        filter.end()
        return guarded({ name: pick.name, ...parseStreamedAnswer(full) }, guard, locale)
      } catch (err) {
        emit('step', { kind: 'failed', agent: pick.name, text: text.failed(pick.name) })
        throw err
      } finally {
        done(index)
      }
    }),
  )
  signal?.throwIfAborted()
  const onTopic = results.filter((result) => result.status === 'fulfilled' && !result.value.offTopic)
  if (onTopic.length > 1) emit('step', { kind: 'merging', text: text.merging })
  const answer = await finish({ store, userId, route, results, fellBack: routed.fellBack, locale })
  // Every specialist said off topic: nothing was shown yet, so the refusal streams like an answer.
  if (answer.guard === 'off_topic' && !wrote) emit('delta', { agent: 'guide', text: answer.reply })
  return answer
}
