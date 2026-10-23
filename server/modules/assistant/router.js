import { pickSpecialists, SPECIALIST_IDS } from '../../../shared/assistant.js'
import { createBoundary, guardRules } from '../../infra/ai/guard/fence.js'
import { AGENTS, ALL_NEEDS, DATA_NEEDS } from './agents.js'
import { clip, conversationBlock, describePage } from './text.js'

const MAX_SPECIALISTS = 2

// boundary: the request's data fence token (the same one the prompt's fences carry).
export const routerSystem = (boundary) => `You route a programming student's question inside Glitch Lab, a debugging study app.
Pick 1 or 2 specialists who can answer it, and the data each one needs. Prefer 1. Pick 2 only when the question really spans both.

Specialists:
${SPECIALIST_IDS.map((id) => `- ${id}: ${AGENTS[id].about}. Data: ${AGENTS[id].needs.join(', ')}`).join('\n')}

"This case", "this note" or "this challenge" means the one open on the current page.
focus: a few words on what the specialist should look at.
When off_topic is true, specialists may be empty.

${guardRules(boundary, 'json')}`

export const ROUTER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    off_topic: { type: 'BOOLEAN' },
    specialists: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', enum: SPECIALIST_IDS },
          needs: { type: 'ARRAY', items: { type: 'STRING', enum: ALL_NEEDS } },
          focus: { type: 'STRING' },
        },
        required: ['name', 'needs'],
      },
    },
  },
  required: ['off_topic', 'specialists'],
}

export function buildRouterPrompt({ messages, page, boundary = createBoundary() }) {
  return `${describePage(page)}

${conversationBlock(messages.slice(-4), boundary)}

Route the student's last message.`
}

// Known specialists only, each once, at most two, and only data keys that specialist may load.
// Throws when nothing usable is left, so the caller falls back.
export function parseRoute(answer) {
  const picked = []
  for (const item of Array.isArray(answer?.specialists) ? answer.specialists : []) {
    if (!SPECIALIST_IDS.includes(item?.name) || picked.some((done) => done.name === item.name)) continue
    const allowed = DATA_NEEDS[item.name]
    const needs = Array.isArray(item.needs) ? allowed.filter((key) => item.needs.includes(key)) : []
    picked.push({ name: item.name, needs: needs.length ? needs : allowed, focus: clip(typeof item.focus === 'string' ? item.focus : '', 200) })
    if (picked.length === MAX_SPECIALISTS) break
  }
  if (!picked.length) throw new Error('Router picked no specialist')
  return picked
}

export const fallbackRoute = (messages, page) =>
  pickSpecialists(messages.at(-1).content, page).map((name) => ({ name, needs: DATA_NEEDS[name], focus: '' }))

// The router only picks who answers: if it's slow, keywords pick instead, so the specialists keep their time.
export const ROUTER_TIMEOUT_MS = 25_000

// The router agent's choice, or a keyword and page based one if the AI call fails or answers nonsense.
// An off-topic question comes back as { route: [], offTopic: true }: no specialist call is made.
// signal: the streamed answer stops routing when the student goes away.
export async function routeQuestion(generate, { messages, page, signal, boundary = createBoundary() }) {
  try {
    const answer = await generate({
      system: routerSystem(boundary),
      prompt: buildRouterPrompt({ messages, page, boundary }),
      schema: ROUTER_SCHEMA,
      timeoutMs: ROUTER_TIMEOUT_MS,
      retry: false,
      ...(signal ? { signal } : {}),
    })
    if (answer?.off_topic === true) return { route: [], fellBack: false, offTopic: true }
    return { route: parseRoute(answer), fellBack: false }
  } catch {
    return { route: fallbackRoute(messages, page), fellBack: true }
  }
}
