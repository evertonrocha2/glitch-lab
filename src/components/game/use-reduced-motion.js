import { useEffect, useState } from 'react'

const REDUCE = '(prefers-reduced-motion: reduce)'

function reducedNow() {
  try {
    return Boolean(window.matchMedia?.(REDUCE).matches)
  } catch {
    return false
  }
}

// True while the reader asks for reduced motion; follows the setting live.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(reducedNow)
  useEffect(() => {
    let query = null
    try {
      query = window.matchMedia?.(REDUCE) ?? null
    } catch {
      query = null
    }
    if (!query?.addEventListener) return undefined
    const onChange = () => setReduced(Boolean(query.matches))
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}
