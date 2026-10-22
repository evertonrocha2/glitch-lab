import { expect, it } from 'vitest'
import { LIMITS } from '../../shared/limits.js'
import { mentionedLines, mergeFiles, preparePayload, readFiles, suggestSelection } from './attachments.js'

const fakeFile = (path, content, size = content.length) => ({ name: path.split('/').pop(), webkitRelativePath: path, size, text: async () => content })

it('reads code files from a folder and skips the rest', async () => {
  const { files, skipped } = await readFiles([
    fakeFile('shop/src/cart.js', 'a'),
    fakeFile('shop/node_modules/lib/index.js', 'b'),
    fakeFile('shop/logo.png', 'c'),
    fakeFile('shop/big.js', 'd', 10_000_000),
    fakeFile('shop\\app\\main.py', 'e'),
  ])
  expect(files).toEqual([
    { path: 'shop/src/cart.js', content: 'a' },
    { path: 'shop/app/main.py', content: 'e' },
  ])
  expect(skipped).toBe(3)
})

it('replaces a file read twice', () => {
  const merged = mergeFiles([{ path: 'a.js', content: 'old' }], [{ path: 'a.js', content: 'new' }, { path: 'b.js', content: 'x' }])
  expect(merged).toEqual([
    { path: 'a.js', content: 'new' },
    { path: 'b.js', content: 'x' },
  ])
})

it('ticks the files the error mentions, or all of a few', () => {
  const files = [{ path: 'shop/src/cart.js' }, { path: 'shop/index.js' }]
  const mentioned = mentionedLines(files, [{ file: '/x/shop/src/cart.js', line: 12 }, { file: 'nowhere.js', line: 1 }])
  expect([...mentioned]).toEqual([['shop/src/cart.js', 12]])
  expect([...suggestSelection(files, mentioned)]).toEqual(['shop/src/cart.js'])
  expect([...suggestSelection(files, new Map())]).toEqual(['shop/src/cart.js', 'shop/index.js'])
  const many = Array.from({ length: 9 }, (_, index) => ({ path: `f${index}.js` }))
  expect(suggestSelection(many, new Map()).size).toBe(0)
})

it('sends the lines around the error for a long file, and keeps every limit', () => {
  const long = Array.from({ length: 500 }, (_, index) => `const line${index + 1} = ${index + 1}`).join('\n')
  const files = [
    { path: 'src/long.js', content: long },
    { path: 'src/short.js', content: 'ok()' },
    { path: 'src/other.js', content: 'x'.repeat(20_000) },
  ]
  const payload = preparePayload(files, new Set(files.map((file) => file.path)), new Map([['src/long.js', 250]]))
  expect(payload[0].content).toContain('>> 250 | const line250 = 250')
  expect(payload[0].content).not.toContain('const line1 = 1\n')
  expect(payload[1]).toEqual({ path: 'src/short.js', content: 'ok()' })
  expect(payload[2].content).toContain('cut here')
  for (const file of payload) expect(file.content.length).toBeLessThanOrEqual(LIMITS.code)
  expect(payload.reduce((sum, file) => sum + file.content.length, 0)).toBeLessThanOrEqual(LIMITS.filesTotal)
})

it('sends nothing when nothing is ticked', () => {
  expect(preparePayload([{ path: 'a.js', content: 'x' }], new Set(), new Map())).toEqual([])
})
