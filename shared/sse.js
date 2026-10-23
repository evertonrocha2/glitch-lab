// A small Server-Sent Events parser, for the API reading a model's stream and for the browser
// reading the assistant's (EventSource can't POST or send an Authorization header).
// push(text) with each decoded chunk, end() when the stream closes. onEvent gets { event, data }
// once per event: `event` is "message" unless the server named it, `data` is the joined data lines.
// Comment lines (": keep-alive") are skipped.
export function createSseParser(onEvent) {
  let buffer = ''
  let event = ''
  let data = []

  const dispatch = () => {
    if (data.length) onEvent({ event: event || 'message', data: data.join('\n') })
    event = ''
    data = []
  }

  const line = (text) => {
    if (text === '') return dispatch()
    if (text.startsWith(':')) return
    const colon = text.indexOf(':')
    const field = colon === -1 ? text : text.slice(0, colon)
    let value = colon === -1 ? '' : text.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }

  return {
    push(text) {
      buffer += text
      // A chunk can end between \r and \n: keep a trailing \r until the next chunk says which.
      const lines = buffer.split(/\r\n|\n|\r(?!$)/)
      buffer = lines.pop()
      for (const item of lines) line(item)
    },
    end() {
      if (buffer !== '') line(buffer.replace(/\r$/, ''))
      buffer = ''
      // Lenient on purpose: a last event without its blank line still counts.
      dispatch()
    },
  }
}
