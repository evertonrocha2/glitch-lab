// Dev only: a small FPS and long-task meter, toggled with Ctrl+Shift+F. Plain DOM, outside React,
// so watching the numbers never adds renders of its own. main.jsx loads it only in `bun run dev`.

const KEY = 'gd:fps-meter'
const WINDOW_MS = 1000
const LONG_TASK_WINDOW_MS = 5000

// Frame gaps (ms) of the last second -> { fps, worst, dropped }. A frame "drops" for every whole
// extra refresh it took against the typical (median) gap, so it works at 60, 120 or 180 Hz.
export function frameStats(gaps) {
  if (gaps.length === 0) return { fps: 0, worst: 0, dropped: 0 }
  const total = gaps.reduce((sum, gap) => sum + gap, 0)
  const sorted = [...gaps].sort((a, b) => a - b)
  const typical = sorted[Math.floor(sorted.length / 2)] || 1000 / 60
  return {
    fps: Math.round((gaps.length * 1000) / total),
    worst: Math.round(sorted.at(-1)),
    dropped: gaps.reduce((sum, gap) => sum + Math.max(0, Math.round(gap / typical) - 1), 0),
  }
}

// Long tasks (ms) that ended in the last 5 seconds -> { count, total }.
export function longTaskStats(tasks, now) {
  const recent = tasks.filter((task) => now - task.end <= LONG_TASK_WINDOW_MS)
  return { count: recent.length, total: Math.round(recent.reduce((sum, task) => sum + task.duration, 0)) }
}

export function installFpsMeter(doc = document) {
  let box = null
  let frame = 0
  let observer = null
  let gaps = []
  let tasks = []
  let last = 0

  const loop = (time) => {
    if (last) gaps.push(time - last)
    last = time
    // Keep about a second of frames.
    let sum = gaps.reduce((total, gap) => total + gap, 0)
    while (gaps.length && sum > WINDOW_MS) sum -= gaps.shift()
    frame = requestAnimationFrame(loop)
  }

  const paint = () => {
    if (!box) return
    const { fps, worst, dropped } = frameStats(gaps)
    const long = longTaskStats(tasks, performance.now())
    tasks = tasks.filter((task) => performance.now() - task.end <= LONG_TASK_WINDOW_MS)
    box.style.color = worst > 50 || long.count ? '#c0262d' : '#1c1d26'
    box.textContent = `${fps} fps · worst ${worst}ms · dropped ${dropped}\nlong tasks (5s): ${long.count} · ${long.total}ms`
  }
  let painter = null

  function show() {
    box = doc.createElement('pre')
    box.setAttribute('aria-hidden', 'true')
    box.dataset.testid = 'fps-meter'
    Object.assign(box.style, {
      position: 'fixed',
      top: '8px',
      right: '8px',
      zIndex: 2147483647,
      margin: 0,
      padding: '4px 8px',
      font: '11px/1.4 "Geist Mono", ui-monospace, monospace',
      background: '#fff',
      border: '2px solid #1c1d26',
      boxShadow: '3px 3px 0 #6a3df0',
      pointerEvents: 'none',
      whiteSpace: 'pre',
    })
    doc.body.append(box)
    gaps = []
    last = 0
    frame = requestAnimationFrame(loop)
    painter = setInterval(paint, 250)
    if (globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask')) {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) tasks.push({ duration: entry.duration, end: entry.startTime + entry.duration })
      })
      observer.observe({ type: 'longtask' })
    }
    paint()
  }

  function hide() {
    cancelAnimationFrame(frame)
    clearInterval(painter)
    observer?.disconnect()
    observer = null
    box?.remove()
    box = null
  }

  function toggle() {
    if (box) hide()
    else show()
    try {
      sessionStorage.setItem(KEY, box ? '1' : '0')
    } catch {
      // Storage blocked: the meter just won't stay on across reloads.
    }
  }

  const onKey = (event) => {
    if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && event.code === 'KeyF') {
      event.preventDefault()
      toggle()
    }
  }
  doc.addEventListener('keydown', onKey)
  try {
    if (sessionStorage.getItem(KEY) === '1') show()
  } catch {
    // Storage blocked: starts hidden.
  }
  return () => {
    hide()
    doc.removeEventListener('keydown', onKey)
  }
}
