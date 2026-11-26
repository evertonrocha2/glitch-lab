import { useCallback, useRef, useState } from 'react'

// Runs one panel action at a time. busy disables the buttons while it runs; notice is the last
// result line ({ kind: 'ok' | 'error', text }) the panel shows in its live region.
// run(call, done): call() is the bound action; done(result) may answer the success text.
export function useActionRunner() {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const running = useRef(false)

  const run = useCallback(async (call, done) => {
    if (running.current) return undefined
    running.current = true
    setBusy(true)
    setNotice(null)
    try {
      const result = await call()
      const text = done?.(result)
      if (text) setNotice({ kind: 'ok', text })
      return result
    } catch (err) {
      setNotice({ kind: 'error', text: err?.message || String(err) })
      return undefined
    } finally {
      running.current = false
      setBusy(false)
    }
  }, [])

  return { run, busy, notice, setNotice }
}
