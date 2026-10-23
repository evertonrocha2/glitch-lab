// Turns an Express response into a Server-Sent Events stream.
// send(event, data) writes `event: <name>\ndata: <json>\n\n`; close() ends it. `signal` aborts when
// the client goes away (tab closed, Stop pressed), so the work behind the stream can stop too.

// Proxies (Render, Vercel) drop a connection that stays quiet for long, and the router alone can
// take 25 seconds. A comment line every few seconds keeps it open and is skipped by every parser.
const KEEP_ALIVE_MS = 10_000

export function openEventStream(res) {
  const controller = new AbortController()
  res.on('close', () => controller.abort())

  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    // no-transform: a proxy must not compress or rewrite the stream, which would buffer it.
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // nginx and similar proxies buffer responses unless told not to.
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()

  const open = () => !res.writableEnded && !res.destroyed
  const write = (text) => {
    if (open()) res.write(text)
  }
  // A first line right away, so a proxy that waits for body bytes passes the stream on.
  write(': open\n\n')
  const keepAlive = setInterval(() => write(': keep-alive\n\n'), KEEP_ALIVE_MS)

  return {
    signal: controller.signal,
    send(event, data) {
      write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    },
    close() {
      clearInterval(keepAlive)
      if (open()) res.end()
    },
  }
}
