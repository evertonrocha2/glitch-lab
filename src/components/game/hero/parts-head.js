import { EYE_STYLES, EYES, INK, RANK, SKIN } from './palette.js'

// Head parts: face, hair (back and front layers) and helms. Local coordinates, body box 0..31.

// Eyes sit on rows 11..14 (big chibi eyes), blush on 15, mouth on 16. `mode` overrides the eye
// style for pose faces ('determinado' when attacking, 'dor' when hurt, 'morte' when dead).
export function face(d, look, mode) {
  const E = EYES[look.eyeColor]
  const S = SKIN[look.skin]
  const style = mode || EYE_STYLES[look.eyeStyle]
  const eye = (ex, rows, y0 = 11) => {
    rows.forEach((row, j) => {
      ;[...row].forEach((ch, i) => {
        const col = { k: INK, w: '#ffffff', i: E.i, I: E.I }[ch]
        if (col) d.paint(ex + i, y0 + j, col)
      })
    })
  }
  if (style !== 'morte') for (const x of [10, 11, 21, 22]) d.paint(x, 15, S.blush)
  if (style === 'redondo') {
    eye(12, ['kk', 'wi', 'ii', 'iI'])
    eye(19, ['kk', 'wi', 'ii', 'iI'])
  }
  if (style === 'brilho') {
    eye(11, ['kkk', '.wi', '.iI', '.Iw'])
    eye(19, ['kkk', 'wi.', 'iI.', 'Iw.'])
  }
  if (style === 'determinado') {
    eye(12, ['k.', 'kk', 'wi', 'iI'])
    eye(19, ['.k', 'kk', 'wi', 'iI'])
  }
  if (style === 'feliz') {
    eye(11, ['.k.', 'k.k'], 12)
    eye(19, ['.k.', 'k.k'], 12)
  }
  if (style === 'dor') {
    eye(12, ['k..', '.k.', 'k..'], 11)
    eye(18, ['..k', '.k.', '..k'], 11)
  }
  if (style === 'morte') {
    eye(11, ['k.k', '.k.', 'k.k'], 11)
    eye(19, ['k.k', '.k.', 'k.k'], 11)
  }
  const M = S.mouth
  const T = '#e0606a'
  const put = (pts) => {
    for (const [x, y, c] of pts) d.paint(x, y, c || M)
  }
  if (style === 'feliz') put([[15, 15], [16, 16], [17, 16], [18, 15]])
  else if (style === 'brilho') put([[16, 16], [17, 16, T]])
  else if (style === 'dor') put([[16, 15], [17, 15], [16, 16, T], [17, 16]])
  else if (style === 'morte') put([[15, 16], [16, 15], [17, 16], [18, 15]])
  else if (style === 'determinado') put([[16, 16], [17, 16], [18, 16]])
  else put([[16, 16], [17, 16]])
}

// Hair that falls behind the head and body.
export function hairBack(d, style) {
  d.part = 'hairback'
  if (style === 'longo') d.poly([[7.5, 7], [24.5, 7], [25.5, 21], [22, 24.5], [10, 24.5], [6.5, 21]], 'hair')
  if (style === 'rabo') {
    d.circ(6.6, 8.2, 2.7, 2.6, 'hair')
    d.circ(4.6, 12, 2.4, 2.5, 'hair')
    d.circ(3.9, 15.6, 2, 2.1, 'hair')
    d.circ(4.4, 18.6, 1.3, 1.6, 'hair')
    for (const [x, y] of [[4, 11], [3, 14], [3, 15]]) d.shade(x, y, 3)
    for (const [x, y] of [[6, 13], [5, 16], [5, 17]]) d.shade(x, y, 0)
  }
  if (style === 'cacheado') d.circ(16, 10, 10.2, 9.2, 'hair', (_x, y) => y <= 15)
}

// Hair on top of the head: the cap, the fringe and highlights.
export function hairFront(d, style) {
  d.part = 'hair'
  const cap = (top = 7) => d.circ(16, 10, 8.3, 7.9, 'hair', (_x, y) => y <= top)
  const fringe = (x0, bottoms) => {
    bottoms.forEach((b, i) => {
      for (let y = 6; y <= b; y++) d.set(x0 + i, y, 'hair')
    })
  }
  const shine = (pts) => {
    for (const [x, y, t] of pts) d.shade(x, y, t)
  }
  if (style === 'curto' || style === 'rabo') {
    cap(7)
    fringe(9, [12, 11, 10, 10, 9, 10, 10, 9, 10, 10, 9, 10, 10, 11, 12])
    d.rect(8, 8, 2, 3, 'hair')
    shine([[11, 4, 3], [12, 4, 3], [13, 3, 3], [14, 3, 2], [10, 5, 2], [12, 8, 0], [16, 8, 0], [19, 8, 0], [15, 6, 0], [20, 5, 0]])
    if (style === 'rabo') {
      d.set(7, 7, 'hair', { c: '#e5484d' })
      d.set(7, 8, 'hair', { c: '#a8202e' })
    }
  }
  if (style === 'espetado') {
    cap(7)
    const spikes = [
      [[9, 7], [4, 2], [12, 4]],
      [[11, 5], [9, -2], [15, 3]],
      [[14, 3], [16, -3], [19, 3]],
      [[18, 3], [23, -2], [22, 6]],
      [[21, 5], [27, 2], [24, 9]],
      [[9, 6], [2, 7], [9, 11]],
    ]
    for (const s of spikes) d.poly(s, 'hair')
    const bangs = [
      [[9.5, 7], [11, 11.5], [13, 7]],
      [[13, 7], [15.5, 11], [18, 7]],
      [[17.5, 7], [21.5, 11.5], [23, 7]],
      [[22, 7], [24, 11], [24.5, 7]],
    ]
    for (const s of bangs) d.poly(s, 'hair')
    d.rect(8, 8, 2, 3, 'hair')
    shine([[12, 3, 3], [13, 3, 3], [11, 4, 3], [14, 2, 2], [16, 0, 3], [10, 1, 2], [21, 1, 2], [13, 9, 0], [17, 8, 0], [20, 9, 0], [17, 4, 0], [21, 6, 0]])
  }
  if (style === 'longo') {
    cap(7)
    d.poly([[8, 6], [24.5, 6], [24.5, 9], [21, 8.5], [17, 10.5], [13, 10.5], [10, 12], [8, 12]], 'hair')
    d.rect(8, 8, 2, 11, 'hair')
    d.rect(23, 8, 2, 7, 'hair')
    shine([[11, 4, 3], [12, 4, 3], [13, 3, 3], [14, 3, 2], [10, 5, 2], [9, 12, 2], [9, 14, 2], [8, 16, 0], [15, 8, 0], [19, 7, 0], [24, 12, 0]])
  }
  if (style === 'cacheado') {
    cap(7)
    const curls = [[9.5, 5.5], [12.5, 3.2], [16, 2.4], [19.5, 3.2], [22.5, 5.5], [24.4, 9.4], [7.6, 9.4], [7.8, 13.2], [24.6, 13]]
    for (const [x, y] of curls) d.circ(x, y, 2.3, 2.3, 'hair')
    const front = [[10.8, 8.4], [14.2, 8], [17.6, 8], [21, 8.4]]
    for (const [x, y] of front) d.circ(x, y, 1.8, 1.8, 'hair')
    for (const [x, y] of [...curls, ...front]) {
      d.shade(Math.floor(x) - 1, Math.floor(y) - 1, 3)
      d.shade(Math.floor(x) + 1, Math.floor(y) + 1, 0)
    }
  }
  if (style === 'raspado') {
    d.circ(16, 10.5, 7.5, 7.2, 'hair', (_x, y) => y <= 6)
    for (let x = 9; x <= 22; x++) if ((x + 7) % 2 === 0) d.set(x, 7, 'hair', { t: 1 })
    for (const [x, y] of [[9, 8], [8, 9]]) d.set(x, y, 'hair', { t: 1 })
    shine([[12, 4, 3], [13, 4, 3], [11, 5, 2]])
  }
}

// Hood: a cloth shell around an open face, its tip falling back, hiding the hair outside the face.
function hood(d, r) {
  const open = (x, y) => {
    const a = (x + 0.5 - 16.6) / 6.4
    const b = (y + 0.5 - 12.6) / 5.8
    return a * a + b * b <= 1
  }
  const inHood = (x, y) => {
    const a = (x + 0.5 - 16) / 9.2
    const b = (y + 0.5 - 10) / 8.6
    if (a * a + b * b <= 1 && y <= 17) return true
    if (x >= 7 && x <= 9 && y >= 12 && y <= 18) return true
    if (x >= 22 && x <= 24 && y >= 12 && y <= 17) return true
    if (y === 18 && x >= 10 && x <= 22) return true
    return false
  }
  for (let y = -1; y <= 20; y++) {
    for (let x = 3; x <= 26; x++) {
      if (!inHood(x, y) || open(x, y)) continue
      const edge = open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1)
      d.set(x, y, edge ? `trim.${r}` : `cloth.${r}`)
    }
  }
  for (let y = -8; y <= 20; y++) for (let x = -2; x <= 34; x++) if (d.get(x, y)?.p === 'hair' && !open(x, y)) d.del(x, y)
  d.poly([[9, 3], [2, 9], [3.5, 11], [9, 8]], `cloth.${r}`)
  if (RANK[r] >= 2) {
    d.set(16, 18, `gem.${r}`)
    d.set(17, 18, `gem.${r}`)
  }
  for (const [x, y] of [[12, 2], [11, 3], [13, 1]]) d.shade(x, y, 3)
  for (const [x, y] of [[22, 4], [23, 6], [9, 16], [8, 17]]) d.shade(x, y, 0)
}

// Iron helm: a dome with a trim brim and cheek guards; crest from uncommon, plume at rare and epic,
// horns at epic, gold wings and a gem at legendary.
function ironHelm(d, r) {
  const R = RANK[r]
  const M = `metal.${r}`
  const T = `trim.${r}`
  d.circ(16, 9.4, 8.7, 7.8, M, (_x, y) => y <= 8)
  d.part = 'helmbrim'
  d.rect(7, 8, 18, 2, T)
  d.part = 'helm'
  d.rect(8, 10, 2, 5, M)
  d.rect(23, 10, 2, 4, M)
  d.rect(16, 10, 2, 2, M)
  for (const [x, y] of [[10, 6], [22, 6], [16, 2]]) d.shade(x, y, 3)
  for (const [x, y] of [[12, 3], [11, 4], [13, 2]]) d.shade(x, y, 3)
  if (R >= 1) {
    d.part = 'crest'
    d.rect(15, 0, 2, 8, T)
  }
  if (R === 2 || R === 3) {
    d.part = 'plume'
    d.poly([[15, 1], [10, -3], [5, -1], [3, 3], [8, 1], [13, 3]], `cloth.${r}`)
    d.shade(9, -2, 3)
    d.shade(7, -1, 2)
    d.shade(5, 1, 0)
  }
  if (R === 3) {
    d.part = 'horn'
    d.poly([[8, 4], [3, 1], [1, -3], [4, 0], [9, 2]], 'bone')
    d.poly([[23, 2], [28, -1], [30, -5], [29, 1], [24, 5]], 'bone')
  }
  if (R === 4) {
    d.part = 'wing'
    d.poly([[8, 5], [1, -1], [3, 3], [0, 3], [4, 6], [2, 8], [8, 8]], 'gold')
    d.poly([[24, 4], [31, -2], [29, 2], [32, 2], [28, 6], [30, 8], [24, 8]], 'gold')
    d.part = 'plume'
    d.poly([[15, 1], [10, -4], [4, -3], [2, 1], [8, 0], [13, 3]], 'cloth.legendary')
    d.set(16, 5, 'gem.legendary')
    d.set(17, 5, 'gem.legendary')
  }
}

export function helm(d, it) {
  d.part = 'helm'
  if (it.b === 'capuz') hood(d, it.r)
  if (it.b === 'capacete-de-ferro') ironHelm(d, it.r)
}
