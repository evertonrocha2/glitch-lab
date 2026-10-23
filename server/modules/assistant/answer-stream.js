import { stripMarkers } from '../../infra/ai/guard/output.js'

// A streamed specialist writes its answer as plain text, then one machine line:
//   ACTIONS: [{"type":"go","target":"/board","label":"Open the board"}]
// The student sees the text as it arrives; the actions line never reaches them.
// An off-topic question gets one line instead, "SCOPE: off_topic", and the server answers itself.

export const ACTIONS_MARKER = 'ACTIONS:'
export const SCOPE_MARKER = 'SCOPE:'

// Models sometimes dress the marker up ("**ACTIONS:**"), so leading spaces and markdown are allowed.
// Other streams end with their own marker (the doubt tutor's CARD:), held back the same way.
// Markers are a word and a colon, so they need no escaping.
export const markerLine = (marker, flags = '') => new RegExp(`(^|\\n)[ \\t*_\`>#-]*${marker}`, flags)
const lineHead = (line) => line.replace(/^[ \t*_`>#-]+/, '')

// True while a line typed so far could still turn into a marker line.
const couldBeMarker = (line, markers) => {
  const head = lineHead(line)
  return markers.some((marker) => marker.startsWith(head) || head.startsWith(marker))
}

const OFF_TOPIC_LINE = /(?:^|\n)[ \t*_`>#-]*SCOPE:\s*off[ _-]?topic/i

// The model's own "this is off topic" line.
export const saysOffTopic = (text) => OFF_TOPIC_LINE.test(String(text ?? ''))

// Where the LAST line starting with `marker` is: { start, end } (end is just past the marker), or
// null. Only the last one is the server's format; an earlier one is the model echoing the student.
export function lastMarker(text, marker) {
  const pattern = markerLine(marker, 'g')
  let found = null
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) found = match
  return found && { start: found.index, end: found.index + found[0].length }
}

// Passes text through to onText as it streams, holding back a last line that may be the start of a
// marker (this stream's own, or the scope line), and nothing at all once one shows up.
// push(chunk) per delta; end(reply) at the end, with the finished reply when it is known: if the
// reply goes on past what was shown (an echoed marker line in the middle), the rest is sent then.
export function createReplyFilter(onText, marker = ACTIONS_MARKER) {
  const markers = [marker, SCOPE_MARKER]
  const patterns = markers.map((item) => markerLine(item))
  let text = ''
  let sent = 0
  let stopped = false
  const emit = (until) => {
    if (until > sent) onText(text.slice(sent, until))
    sent = Math.max(sent, until)
  }
  return {
    push(chunk) {
      if (stopped || !chunk) return
      text += chunk
      const found = patterns.map((pattern) => pattern.exec(text)).filter(Boolean).sort((a, b) => a.index - b.index)[0]
      if (found) {
        stopped = true
        emit(found.index + found[1].length)
        return
      }
      const lastLine = text.slice(text.lastIndexOf('\n') + 1)
      emit(couldBeMarker(lastLine, markers) ? text.length - lastLine.length : text.length)
    },
    end(reply) {
      if (!stopped) emit(text.length)
      stopped = true
      const shown = text.slice(0, sent).trimEnd()
      if (typeof reply === 'string' && reply.length > shown.length && reply.startsWith(shown)) onText(reply.slice(shown.length))
    },
  }
}

// The finished text as { reply, actions }: everything before the last marker line (with any other
// marker line taken out), and the JSON array after it (an empty list when it is missing or broken;
// the actions are checked later anyway).
export function splitActions(text) {
  const full = String(text ?? '')
  const marker = lastMarker(full, ACTIONS_MARKER)
  if (!marker) return { reply: stripMarkers(full), actions: [] }
  const reply = stripMarkers(full.slice(0, marker.start))
  const rest = full.slice(marker.end)
  const start = rest.indexOf('[')
  const end = rest.lastIndexOf(']')
  if (start === -1 || end < start) return { reply, actions: [] }
  try {
    const actions = JSON.parse(rest.slice(start, end + 1))
    return { reply, actions: Array.isArray(actions) ? actions : [] }
  } catch {
    return { reply, actions: [] }
  }
}
