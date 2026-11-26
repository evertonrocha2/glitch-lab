// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))

// Only this app may frame its pages (the game's study window does, in embed mode): no other site can
// show them chrome-less inside its own page.
it('tells browsers that only this site may frame its pages', () => {
  const rule = config.headers.find((each) => each.source === '/(.*)')
  const headers = Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]))
  expect(headers['Content-Security-Policy']).toBe("frame-ancestors 'self'")
  expect(headers['X-Frame-Options']).toBe('SAMEORIGIN')
})

it('keeps the font cache rule and the rewrites', () => {
  expect(config.headers.some((each) => each.source === '/fonts/(.*)')).toBe(true)
  expect(config.rewrites).toHaveLength(2)
})
