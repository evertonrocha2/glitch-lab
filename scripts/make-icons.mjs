// Draws the favicon and app icons in public/ from the 16x16 logo (src/components/ui/pixel-logo/
// logo-pixels.js), so the icons are the drawing itself. No dependencies: PNGs are written by hand
// (zlib + CRC) and the ICO wraps PNGs. Run: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { LOGO_ROWS, LOGO_ROWS_DETAILED, LOGO_PALETTE, logoRuns } from '../src/components/ui/pixel-logo/logo-pixels.js'

const NIGHT = '#120c22'
const out = (name) => new URL(`../public/${name}`, import.meta.url)

const rgba = (hex) => {
  const h = hex.slice(1)
  return [0, 2, 4, 6].map((i) => (i < h.length ? Number.parseInt(h.slice(i, i + 2), 16) : 255))
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

// The logo at an integer scale, centered on a size x size canvas, over an optional solid background.
function png(size, scale, { background = null, rows = LOGO_ROWS } = {}) {
  const px = new Uint8Array(size * size * 4)
  if (background) {
    const [r, g, b] = rgba(background)
    for (let i = 0; i < size * size; i++) px.set([r, g, b, 255], i * 4)
  }
  const offset = Math.floor((size - 16 * scale) / 2)
  rows.forEach((row, y) => {
    ;[...row].forEach((cell, x) => {
      if (cell === '.') return
      const [r, g, b, a] = rgba(LOGO_PALETTE[cell])
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = ((offset + y * scale + dy) * size + offset + x * scale + dx) * 4
          // Source-over on whatever is already there (the background, or nothing).
          const alpha = a / 255
          const under = px[i + 3] / 255
          const outA = alpha + under * (1 - alpha)
          for (let c = 0; c < 3; c++) px[i + c] = Math.round(([r, g, b][c] * alpha + px[i + c] * under * (1 - alpha)) / (outA || 1))
          px[i + 3] = Math.round(outA * 255)
        }
      }
    })
  })
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    Buffer.from(px.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function ico(images) {
  const head = Buffer.alloc(6 + images.length * 16)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(images.length, 4)
  let offset = head.length
  images.forEach(({ size, data }, i) => {
    const e = 6 + i * 16
    head[e] = size >= 256 ? 0 : size
    head[e + 1] = size >= 256 ? 0 : size
    head.writeUInt16LE(1, e + 4)
    head.writeUInt16LE(32, e + 6)
    head.writeUInt32LE(data.length, e + 8)
    head.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([head, ...images.map(({ data }) => data)])
}

const svgRects = logoRuns(LOGO_ROWS)
  .map(({ x, y, width, fill }) => {
    const hex = fill.length === 9 ? `${fill.slice(0, 7)}" fill-opacity="${(Number.parseInt(fill.slice(7), 16) / 255).toFixed(2)}` : fill
    return `  <rect x="${x}" y="${y}" width="${width}" height="1" fill="${hex}"/>`
  })
  .join('\n')
writeFileSync(
  out('favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">\n  <!-- StudyQuest, "Grimorio": made by scripts/make-icons.mjs from src/components/ui/pixel-logo/logo-pixels.js -->\n${svgRects}\n</svg>\n`,
)
writeFileSync(out('favicon-32.png'), png(32, 2))
writeFileSync(out('favicon.ico'), ico([16, 32, 48].map((size) => ({ size, data: png(size, size / 16) }))))
// App icons sit on the night with a margin; at these sizes the detailed cut reads as one book.
writeFileSync(out('apple-touch-icon.png'), png(180, 10, { background: NIGHT, rows: LOGO_ROWS_DETAILED }))
writeFileSync(out('icon-192.png'), png(192, 10, { background: NIGHT, rows: LOGO_ROWS_DETAILED }))
writeFileSync(out('icon-512.png'), png(512, 28, { background: NIGHT, rows: LOGO_ROWS_DETAILED }))
console.log('icons written to public/')
