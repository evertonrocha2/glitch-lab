import { createSseParser } from '../../../shared/sse.js'

// Reads a fetch Response body as Server-Sent Events and calls onData with each event's data.
// onData may return true to stop reading early (a provider's "[DONE]"); if it throws, reading
// stops and the error goes up.
export async function readEventStream(res, onData) {
  if (!res.body) return
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let stop = false
  let finished = false
  const parser = createSseParser(({ data }) => {
    if (!stop && onData(data) === true) stop = true
  })
  try {
    while (!stop) {
      const { done, value } = await reader.read()
      if (done) {
        finished = true
        break
      }
      parser.push(decoder.decode(value, { stream: true }))
    }
    if (!stop) {
      parser.push(decoder.decode())
      parser.end()
    }
  } finally {
    // Stopped early or failed: tell the provider we're done, so the connection closes.
    if (!finished) await reader.cancel().catch(() => {})
  }
}
