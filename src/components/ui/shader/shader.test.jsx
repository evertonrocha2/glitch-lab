import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLoop, MAX_DPR, mountShader, webglContext } from './gl-runner.js'
import ShaderBackdrop from './shader-backdrop.jsx'
import { SHADERS } from './shaders.js'

// A pretend requestAnimationFrame: frames run only when the test calls tick().
function fakeFrames() {
  let next = 1
  const pending = new Map()
  return {
    request: (cb) => {
      const id = next++
      pending.set(id, cb)
      return id
    },
    cancel: (id) => pending.delete(id),
    tick(now) {
      const due = [...pending.values()]
      pending.clear()
      for (const cb of due) cb(now)
    },
    count: () => pending.size,
  }
}

// Just enough of a WebGL context to record what the helper asks of it.
function fakeGl({ compiles = true } = {}) {
  const calls = { draws: 0, uniforms: [], viewport: null, lost: 0 }
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    FLOAT: 7,
    TRIANGLES: 8,
    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => compiles,
    getShaderInfoLog: () => 'nope',
    deleteShader: () => {},
    createProgram: () => ({}),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    useProgram: () => {},
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
    getAttribLocation: () => 0,
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    getUniformLocation: (_prog, name) => name,
    uniform1f: (name, value) => calls.uniforms.push([name, value]),
    uniform2f: (name, x, y) => calls.uniforms.push([name, x, y]),
    viewport: (x, y, w, h) => {
      calls.viewport = [x, y, w, h]
    },
    drawArrays: () => {
      calls.draws++
    },
    getExtension: () => ({ loseContext: () => calls.lost++ }),
  }
  return { gl, calls }
}

function host(width = 400, height = 200) {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientWidth', { value: width })
  Object.defineProperty(el, 'clientHeight', { value: height })
  document.body.appendChild(el)
  return el
}

const query = (matches) => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('createLoop', () => {
  it('runs only while visible, shown and allowed to move', () => {
    const frames = fakeFrames()
    const draw = vi.fn()
    const loop = createLoop({ step: () => {}, draw, ...frames })
    expect(loop.running()).toBe(false)

    loop.set({ visible: true })
    expect(loop.running()).toBe(true)
    frames.tick(16)
    expect(draw).toHaveBeenCalledTimes(1)

    loop.set({ hidden: true })
    expect(loop.running()).toBe(false)
    expect(frames.count()).toBe(0)

    loop.set({ hidden: false })
    expect(loop.running()).toBe(true)

    loop.set({ visible: false })
    expect(loop.running()).toBe(false)
  })

  it('never runs under reduced motion', () => {
    const frames = fakeFrames()
    const loop = createLoop({ step: () => {}, draw: () => {}, ...frames })
    loop.set({ visible: true, reduced: true })
    expect(loop.running()).toBe(false)
    loop.set({ reduced: false })
    expect(loop.running()).toBe(true)
  })

  it('caps a long step, so a tab coming back does not jump ahead', () => {
    const frames = fakeFrames()
    const steps = []
    const loop = createLoop({ step: (dt) => steps.push(dt), draw: () => {}, ...frames })
    loop.set({ visible: true })
    frames.tick(1000)
    frames.tick(1016)
    frames.tick(9000)
    expect(steps[0]).toBe(0)
    expect(steps[1]).toBeCloseTo(0.016)
    expect(steps[2]).toBe(0.05)
  })

  it('restarts the clock from zero after a pause', () => {
    const frames = fakeFrames()
    const steps = []
    const loop = createLoop({ step: (dt) => steps.push(dt), draw: () => {}, ...frames })
    loop.set({ visible: true })
    frames.tick(100)
    loop.set({ visible: false })
    loop.set({ visible: true })
    frames.tick(5000)
    expect(steps).toEqual([0, 0])
  })

  it('stays stopped for good after stop()', () => {
    const frames = fakeFrames()
    const loop = createLoop({ step: () => {}, draw: () => {}, ...frames })
    loop.set({ visible: true })
    loop.stop()
    loop.set({ visible: true, hidden: false })
    expect(loop.running()).toBe(false)
  })
})

describe('mountShader', () => {
  it('leaves nothing behind without WebGL', () => {
    const el = host()
    expect(webglContext(document.createElement('canvas'))).toBeNull()
    expect(mountShader(el, { fragment: 'x' })).toBeNull()
    expect(el.querySelector('canvas')).toBeNull()
  })

  it('leaves nothing behind when the shader does not compile', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = host()
    const { gl } = fakeGl({ compiles: false })
    expect(mountShader(el, { fragment: 'x', env: { getContext: () => gl, reducedQuery: query(false) } })).toBeNull()
    expect(el.querySelector('canvas')).toBeNull()
  })

  it('paints a first frame at a capped pixel ratio', () => {
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(3)
    const el = host(400, 200)
    const { gl, calls } = fakeGl()
    const onReady = vi.fn()
    const shader = mountShader(el, { fragment: 'x', t0: 7, onReady, env: { getContext: () => gl, reducedQuery: query(false) } })
    const canvas = el.querySelector('canvas')
    expect(canvas).not.toBeNull()
    expect(canvas.width).toBe(400 * MAX_DPR)
    expect(canvas.height).toBe(200 * MAX_DPR)
    expect(calls.viewport).toEqual([0, 0, 600, 300])
    expect(calls.draws).toBeGreaterThan(0)
    expect(calls.uniforms).toContainEqual(['u_time', 7])
    expect(onReady).toHaveBeenCalled()
    shader.destroy()
  })

  it('holds one still frame under reduced motion', () => {
    const el = host()
    const { gl } = fakeGl()
    const shader = mountShader(el, { fragment: 'x', env: { getContext: () => gl, reducedQuery: query(true) } })
    // jsdom has no IntersectionObserver, so the shader counts as on screen: only reduced motion holds it.
    expect(shader.running()).toBe(false)
    shader.destroy()
  })

  it('pauses while the tab is hidden', () => {
    const el = host()
    const { gl } = fakeGl()
    const shader = mountShader(el, { fragment: 'x', env: { getContext: () => gl, reducedQuery: query(false) } })
    expect(shader.running()).toBe(true)
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(shader.running()).toBe(false)
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(shader.running()).toBe(true)
    shader.destroy()
    expect(shader.running()).toBe(false)
  })

  it('falls back to the gradient when the GPU drops the context', () => {
    const el = host()
    const { gl } = fakeGl()
    const onLost = vi.fn()
    const shader = mountShader(el, { fragment: 'x', onLost, env: { getContext: () => gl, reducedQuery: query(false) } })
    const lost = new Event('webglcontextlost', { cancelable: true })
    el.querySelector('canvas').dispatchEvent(lost)
    expect(lost.defaultPrevented).toBe(true)
    expect(el.querySelector('canvas')).toBeNull()
    expect(onLost).toHaveBeenCalled()
    expect(shader.running()).toBe(false)
  })

  it('removes its canvas and frees the context on destroy', () => {
    const el = host()
    const { gl, calls } = fakeGl()
    const shader = mountShader(el, { fragment: 'x', env: { getContext: () => gl, reducedQuery: query(false) } })
    shader.destroy()
    expect(el.querySelector('canvas')).toBeNull()
    expect(calls.lost).toBe(1)
  })
})

describe('ShaderBackdrop', () => {
  it.each(Object.keys(SHADERS))('shows the CSS gradient without WebGL (%s)', (kind) => {
    const { container } = render(
      <div style={{ position: 'relative' }}>
        <ShaderBackdrop kind={kind} interactive />
      </div>,
    )
    const backdrop = container.querySelector(`[data-shader="${kind}"]`)
    expect(backdrop).toHaveAttribute('aria-hidden', 'true')
    expect(backdrop).toHaveAttribute('data-gl', 'off')
    expect(backdrop.style.background).toContain('gradient')
    expect(backdrop.querySelector('canvas')).toBeNull()
  })

  it('both shaders read the uniforms the helper sets', () => {
    for (const { fragment } of Object.values(SHADERS)) {
      expect(fragment).toContain('uniform vec2 u_res')
      expect(fragment).toContain('uniform float u_time')
      expect(fragment).toContain('gl_FragColor')
    }
    expect(SHADERS.arcana.fragment).toContain('uniform vec2 u_pointer')
    expect(SHADERS.arcana.fragment).toContain('uniform float u_scroll')
  })
})
