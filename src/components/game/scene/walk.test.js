import { describe, expect, it } from 'vitest'
import { worldById } from '../../../../shared/world/worlds.js'
import { cameraOn, directionOf, sideOf, STEP_MS } from './walk.js'

const cave = worldById('caverna-sql') // 32x20
const tiny = { rows: ['.....', '.....'] }

describe('cameraOn', () => {
  it('centers the hero and stops at the edges of the map', () => {
    const crop = { w: 24, h: 15 }
    expect(cameraOn(cave, { x: 16, y: 10 }, crop)).toEqual({ x: 4.5, y: 3 })
    expect(cameraOn(cave, { x: 0, y: 0 }, crop)).toEqual({ x: 0, y: 0 })
    expect(cameraOn(cave, { x: 47, y: 31 }, crop)).toEqual({ x: 24, y: 17 })
  })

  it('follows a hero between two tiles', () => {
    expect(cameraOn(cave, { x: 16.25, y: 10 }, { w: 24, h: 15 }).x).toBeCloseTo(4.75)
  })

  it('keeps the camera at 0 when the whole map fits', () => {
    expect(cameraOn(tiny, { x: 4, y: 1 }, { w: 5, h: 2 })).toEqual({ x: 0, y: 0 })
  })
})

it('faces left or right, and keeps the last side when walking up or down', () => {
  expect(sideOf('left')).toBe(-1)
  expect(sideOf('right', -1)).toBe(1)
  expect(sideOf('up', -1)).toBe(-1)
  expect(sideOf('down')).toBe(1)
})

it('reads the arrows and WASD, in either case, and nothing else', () => {
  expect(directionOf('ArrowUp')).toBe('up')
  expect(directionOf('a')).toBe('left')
  expect(directionOf('D')).toBe('right')
  expect(directionOf('Enter')).toBeNull()
  expect(directionOf(undefined)).toBeNull()
})

it('takes 10 steps a second', () => {
  expect(STEP_MS).toBe(100)
})
