// A streamed specialist writes its answer as plain text, then one machine line:
//   ACTIONS: [{"type":"go","target":"/board","label":"Open the board"}]
// The student sees the text as it arrives; the actions line never reaches them.

export const ACTIONS_MARKER = 'ACTIONS:'

// Models sometimes dress the marker up ("**ACTIONS:**"), so leading spaces and markdown are allowed.
const MARKER_LINE = /(^|\n)[ \t*_`>#-]*ACTIONS:/
const lineHead = (line) => line.replace(/^[ \t*_`>#-]+/, '')

// True while a line typed so far could still turn into the marker line.
const couldBeMarker = (line) => {
  const head = lineHead(line)
  return ACTIONS_MARKER.startsWith(head) || head.startsWith(ACTIONS_MARKER)
}

// Passes text through to onText as it streams, holding back a last line that may be the start of
// the marker, and nothing at all once the marker shows up. push(chunk) per delta, end() at the end.
export function createReplyFilter(onText) {
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
      const marker = MARKER_LINE.exec(text)
      if (marker) {
        stopped = true
        emit(marker.index + marker[1].length)
        return
      }
      const lastLine = text.slice(text.lastIndexOf('\n') + 1)
      emit(couldBeMarker(lastLine) ? text.length - lastLine.length : text.length)
    },
    end() {
      if (!stopped) emit(text.length)
      stopped = true
    },
  }
}

// The finished text as { reply, actions }: everything before the marker line, and the JSON array
// after it (an empty list when it is missing or broken; the actions are checked later anyway).
export function splitActions(text) {
  const full = String(text ?? '')
  const marker = MARKER_LINE.exec(full)
  if (!marker) return { reply: full.trim(), actions: [] }
  const reply = full.slice(0, marker.index).trim()
  const rest = full.slice(marker.index + marker[0].length)
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
