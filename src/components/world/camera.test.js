import { expect, it } from 'vitest'
import { worldById } from '../../../shared/world/worlds.js'
import { cameraFor, viewportFor } from './camera.js'

const forest = worldById('floresta-js') // 32x20
const hub = worldById('laboratorio') // 20x14

it('fits 15x10 tiles on a wide screen and 7x7 on a phone', () => {
  expect(viewportFor(1200)).toEqual({ cols: 15, rows: 10 })
  expect(viewportFor(720)).toEqual({ cols: 15, rows: 10 })
  expect(viewportFor(480)).toEqual({ cols: 10, rows: 7 })
  expect(viewportFor(360)).toEqual({ cols: 7, rows: 7 })
  expect(viewportFor(0)).toEqual({ cols: 7, rows: 7 })
})

it('centers the hero and stops at the edges of the map', () => {
  const view = { cols: 15, rows: 10 }
  expect(cameraFor(forest, { x: 16, y: 10 }, view)).toEqual({ x: 9, y: 5 })
  expect(cameraFor(forest, { x: 0, y: 0 }, view)).toEqual({ x: 0, y: 0 })
  expect(cameraFor(forest, { x: 31, y: 19 }, view)).toEqual({ x: 17, y: 10 })
})

it('keeps the camera at 0 when the map is smaller than the screen', () => {
  expect(cameraFor({ ...hub, rows: hub.rows.slice(0, 6) }, { x: 9, y: 3 }, { cols: 15, rows: 10 })).toEqual({ x: 2, y: 0 })
  expect(cameraFor({ rows: ['....'] }, { x: 3, y: 0 }, { cols: 7, rows: 7 })).toEqual({ x: 0, y: 0 })
})
