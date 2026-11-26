import { expect, it } from 'vitest'
// Not './lazy-pages.js': the test config swaps that one for the eager pages.
import { preloadOrder } from '../app/lazy-pages.js'

it('preloads the world page chunk first, then the rest in their order', () => {
  const paths = ['../pages/board-page/board-page.jsx', '../pages/world-page/world-page.jsx', '../pages/daily-page/daily-page.jsx']
  expect(preloadOrder(paths)).toEqual(['../pages/world-page/world-page.jsx', '../pages/board-page/board-page.jsx', '../pages/daily-page/daily-page.jsx'])
  expect(preloadOrder(['../pages/a-page/a-page.jsx'])).toEqual(['../pages/a-page/a-page.jsx'])
})
