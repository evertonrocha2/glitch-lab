import { useEffect, useRef, useState } from 'react'
import { mountShader } from './gl-runner.js'
import { SHADERS } from './shaders.js'

// A shader painted behind a hero or a CTA band, filling its positioned parent. The CSS gradient is
// always there: it is what shows without WebGL, while the canvas fades in, and after a lost context.
// WebGL starts only when the backdrop first comes near the screen, so a band far down the page costs
// nothing on load. `interactive`: the shader follows the pointer over the parent and the scroll.
export default function ShaderBackdrop({ kind, interactive = false, className = '' }) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)
  const shader = SHADERS[kind]

  useEffect(() => {
    const host = ref.current
    if (!host || !shader) return undefined
    const win = host.ownerDocument.defaultView ?? globalThis
    let mounted = null
    let cleanups = []

    const start = () => {
      if (mounted) return
      mounted = mountShader(host, {
        fragment: shader.fragment,
        t0: shader.t0,
        onReady: () => win.requestAnimationFrame?.(() => setReady(true)),
        onLost: () => {
          mounted = null
          setReady(false)
        },
      })
      if (!mounted || !interactive) return
      const parent = host.parentElement ?? host
      const onPointer = (event) => {
        const box = host.getBoundingClientRect()
        if (!box.width || !box.height) return
        mounted?.setPointer((event.clientX - box.left) / box.width, 1 - (event.clientY - box.top) / box.height)
      }
      const onScroll = () => {
        const box = host.getBoundingClientRect()
        mounted?.setScroll(box.height ? -box.top / box.height : 0)
      }
      parent.addEventListener('pointermove', onPointer, { passive: true })
      win.addEventListener('scroll', onScroll, { passive: true })
      onScroll()
      cleanups = [() => parent.removeEventListener('pointermove', onPointer), () => win.removeEventListener('scroll', onScroll)]
    }

    let lazy = null
    if (typeof win.IntersectionObserver === 'function') {
      lazy = new win.IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return
          lazy.disconnect()
          start()
        },
        { rootMargin: '300px' },
      )
      lazy.observe(host)
    } else {
      start()
    }

    return () => {
      lazy?.disconnect()
      for (const cleanup of cleanups) cleanup()
      mounted?.destroy()
      mounted = null
    }
  }, [shader, interactive])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-shader={kind}
      data-gl={ready ? 'on' : 'off'}
      className={`pointer-events-none absolute inset-0 overflow-hidden [&>canvas]:absolute [&>canvas]:inset-0 [&>canvas]:block [&>canvas]:size-full [&>canvas]:transition-opacity [&>canvas]:duration-1000 ${ready ? '[&>canvas]:opacity-100' : '[&>canvas]:opacity-0'} ${className}`}
      style={{ background: shader?.fallback }}
    />
  )
}
