import { expect, it } from 'vitest'
import { boxOf, placeBeside } from './place.js'

// A 600 x 400 box (the console) with a 50px cell; the popover is 200 x 150.
const bounds = { left: 0, top: 0, right: 600, bottom: 400 }
const size = { width: 200, height: 150 }
const cell = (left, top, side = 50) => ({ left, top, right: left + side, bottom: top + side })
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
const rectOf = (place) => ({ left: place.x, top: place.y, right: place.x + place.width, bottom: place.y + place.height })
const inside = (rect, box) => rect.left >= box.left && rect.top >= box.top && rect.right <= box.right && rect.bottom <= box.bottom

it('sits to the right of the cell, top aligned, when there is room', () => {
  const place = placeBeside(cell(100, 100), size, bounds, 8)
  expect(place).toMatchObject({ side: 'right', x: 158, y: 100, width: 200, height: 150 })
})

it('flips to the left near the right edge', () => {
  const place = placeBeside(cell(500, 100), size, bounds, 8)
  expect(place).toMatchObject({ side: 'left', x: 292, y: 100 })
})

it('goes below, then above, when neither side has room', () => {
  const narrow = { left: 0, top: 0, right: 300, bottom: 600 }
  expect(placeBeside(cell(125, 100), size, narrow, 8)).toMatchObject({ side: 'bottom', x: 100, y: 158 })
  expect(placeBeside(cell(125, 500), size, narrow, 8)).toMatchObject({ side: 'top', y: 342 })
})

it('slides up to stay inside the box near the bottom, still beside the cell', () => {
  const place = placeBeside(cell(100, 340), size, bounds, 8)
  expect(place).toMatchObject({ side: 'right', x: 158, y: 250 })
})

it('slides along the bottom edge without leaving the box', () => {
  const narrow = { left: 0, top: 0, right: 260, bottom: 600 }
  const place = placeBeside(cell(205, 100), size, narrow, 8)
  expect(place.side).toBe('bottom')
  expect(place.x).toBe(60)
})

it('never covers the cell and stays inside the box, wherever the cell is', () => {
  for (let left = 0; left <= 550; left += 25) {
    for (let top = 0; top <= 350; top += 25) {
      const anchor = cell(left, top)
      const place = placeBeside(anchor, size, bounds, 8)
      const rect = rectOf(place)
      expect(overlaps(rect, anchor)).toBe(false)
      expect(inside(rect, bounds)).toBe(true)
    }
  }
})

it('shrinks to the roomiest side when nothing fits whole, so it still never covers the cell', () => {
  const tight = { left: 0, top: 0, right: 320, bottom: 200 }
  const anchor = cell(140, 70, 60)
  const place = placeBeside(anchor, { width: 260, height: 400 }, tight, 8)
  expect(place.side).toBe('left')
  expect(place.width).toBe(132)
  expect(place.height).toBe(200)
  expect(overlaps(rectOf(place), anchor)).toBe(false)
  expect(inside(rectOf(place), tight)).toBe(true)
})

it('keeps a tall popover inside the box by capping its height', () => {
  const place = placeBeside(cell(100, 100), { width: 200, height: 900 }, bounds, 8)
  expect(place).toMatchObject({ side: 'right', y: 0, height: 400 })
})

it('takes the order of sides it is given', () => {
  expect(placeBeside(cell(250, 150), size, bounds, 8, ['left', 'right']).side).toBe('left')
})

it('boxOf crosses the frame with the viewport and keeps a margin', () => {
  expect(boxOf({ left: -40, top: 100, right: 900, bottom: 2000 }, { width: 800, height: 600 }, 8)).toEqual({ left: 8, top: 108, right: 792, bottom: 592 })
  // No frame: the viewport.
  expect(boxOf(null, { width: 800, height: 600 }, 8)).toEqual({ left: 8, top: 8, right: 792, bottom: 592 })
})
