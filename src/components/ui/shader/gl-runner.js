// A tiny WebGL helper for full-bleed fragment shaders (the landing's névoa arcana and brasas).
// One triangle covers the canvas; the fragment shader gets u_res (pixels), u_time (seconds),
// u_pointer (0..1, eased) and u_scroll (0..1). No dependency, no state shared between mounts.

// Phones with 3x screens would paint 9x the pixels for no visible gain behind text.
export const MAX_DPR = 1.5

// The longest step a frame may take, so a tab coming back never jumps the animation forward.
const MAX_STEP = 0.05

const VERTEX = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'

// The frame loop on its own, so the pause and resume rules can be tested without a GPU.
// It runs only while visible, the tab is shown and motion is allowed. `step(dt)` advances the clock;
// `draw()` paints. `request`/`cancel` default to requestAnimationFrame.
export function createLoop({ step, draw, request, cancel }) {
  const raf = request ?? ((cb) => globalThis.requestAnimationFrame(cb))
  const caf = cancel ?? ((id) => globalThis.cancelAnimationFrame(id))
  const state = { visible: false, hidden: false, reduced: false }
  let id = 0
  let last = 0
  let stopped = false

  const frame = (now) => {
    const dt = last ? Math.min(MAX_STEP, (now - last) / 1000) : 0
    last = now
    step(dt)
    draw()
    id = raf(frame)
  }

  const update = () => {
    const run = !stopped && state.visible && !state.hidden && !state.reduced
    if (run && !id) {
      last = 0
      id = raf(frame)
    } else if (!run && id) {
      caf(id)
      id = 0
    }
  }

  return {
    set(patch) {
      Object.assign(state, patch)
      update()
    },
    running: () => id !== 0,
    stop() {
      stopped = true
      update()
    },
  }
}

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  console.warn(gl.getShaderInfoLog(shader))
  gl.deleteShader(shader)
  return null
}

// The program for `fragment`, or null when the driver rejects it.
function program(gl, fragment) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment)
  if (!vs || !fs) return null
  const prog = gl.createProgram()
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  return prog
}

// A WebGL 1 context for the canvas, or null (no WebGL, blocked GPU, too many contexts).
export function webglContext(canvas) {
  if (typeof globalThis.WebGLRenderingContext === 'undefined') return null
  const options = { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false }
  try {
    return canvas.getContext('webgl', options) ?? canvas.getContext('experimental-webgl', options)
  } catch {
    return null
  }
}

// Mounts `fragment` on a new canvas inside `host`. Returns null (and leaves no canvas behind) when
// WebGL is missing or the shader fails, so the host's CSS gradient stays as the fallback.
// t0: the time shown as the one still frame under reduced motion (and where the clock starts).
// onReady: the first frame is painted (the host fades the canvas in). onLost: the GPU dropped the
// context; the canvas is gone and the fallback shows again.
// env: { getContext, reducedQuery } for tests.
export function mountShader(host, { fragment, t0 = 10, onReady, onLost, env = {} }) {
  const doc = host.ownerDocument
  const win = doc.defaultView ?? globalThis
  const canvas = doc.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  const gl = (env.getContext ?? webglContext)(canvas)
  if (!gl) return null
  const prog = program(gl, fragment)
  if (!prog) return null
  host.appendChild(canvas)

  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook.
  gl.useProgram(prog)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'a')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const u = {
    res: gl.getUniformLocation(prog, 'u_res'),
    time: gl.getUniformLocation(prog, 'u_time'),
    pointer: gl.getUniformLocation(prog, 'u_pointer'),
    scroll: gl.getUniformLocation(prog, 'u_scroll'),
  }

  let time = t0
  const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }
  let scroll = 0
  let lost = false

  const draw = () => {
    if (lost) return
    gl.uniform1f(u.time, time)
    gl.uniform2f(u.pointer, pointer.x, pointer.y)
    gl.uniform1f(u.scroll, scroll)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  const step = (dt) => {
    time += dt
    // Ease toward the pointer: about a third of a second to settle.
    const k = 1 - Math.exp(-dt * 6)
    pointer.x += (pointer.tx - pointer.x) * k
    pointer.y += (pointer.ty - pointer.y) * k
  }
  const loop = createLoop({ step, draw })

  const resize = () => {
    const dpr = Math.min(win.devicePixelRatio || 1, MAX_DPR)
    const w = Math.max(1, Math.round(host.clientWidth * dpr))
    const h = Math.max(1, Math.round(host.clientHeight * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
      gl.uniform2f(u.res, w, h)
    }
    if (!loop.running()) draw()
  }

  const reducedQuery = env.reducedQuery ?? win.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null
  const onReduced = () => {
    const reduced = Boolean(reducedQuery?.matches)
    if (reduced) {
      time = t0
      pointer.x = pointer.tx = 0.5
      pointer.y = pointer.ty = 0.5
      draw()
    }
    loop.set({ reduced })
  }
  const onVisibility = () => loop.set({ hidden: doc.hidden })

  const resizer = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(resize) : null
  resizer?.observe(host)
  const watcher =
    typeof win.IntersectionObserver === 'function'
      ? new win.IntersectionObserver((entries) => loop.set({ visible: entries[entries.length - 1].isIntersecting }), { rootMargin: '80px' })
      : null
  watcher?.observe(host)
  doc.addEventListener('visibilitychange', onVisibility)
  reducedQuery?.addEventListener?.('change', onReduced)

  const teardown = () => {
    loop.stop()
    resizer?.disconnect()
    watcher?.disconnect()
    doc.removeEventListener('visibilitychange', onVisibility)
    reducedQuery?.removeEventListener?.('change', onReduced)
    canvas.removeEventListener('webglcontextlost', onContextLost)
  }
  function onContextLost(event) {
    event.preventDefault()
    lost = true
    teardown()
    canvas.remove()
    onLost?.()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  resize()
  loop.set({ hidden: doc.hidden, reduced: Boolean(reducedQuery?.matches), visible: !watcher })
  draw()
  onReady?.()

  return {
    // x, y: 0..1 across the host, y up (as in the shader).
    setPointer(x, y) {
      pointer.tx = Math.min(1, Math.max(0, x))
      pointer.ty = Math.min(1, Math.max(0, y))
    },
    setScroll(value) {
      scroll = Math.min(1, Math.max(0, value))
    },
    running: () => loop.running(),
    destroy() {
      if (lost) return
      teardown()
      canvas.remove()
      gl.getExtension?.('WEBGL_lose_context')?.loseContext()
    },
  }
}
