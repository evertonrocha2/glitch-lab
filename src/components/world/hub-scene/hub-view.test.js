import { describe, expect, it } from 'vitest'
import { unlocks } from '../../../../shared/world/unlocks.js'
import { worldById } from '../../../../shared/world/worlds.js'
import { approach, cameraOn, cropFor, fitCrop, heroPose, lockedPortals, lockedRects, sideOf, tileAtPoint } from './hub-view.js'

const lab = worldById('laboratorio') // 15x10
const cave = worldById('caverna-sql') // 32x20

const stateWith = ({ codeSolved = 0, ...areas } = {}) => unlocks({ enemCorrect: { linguagens: 0, humanas: 0, natureza: 0, matematica: 0, ...areas }, codeSolved })

describe('cropFor', () => {
  it('shows at most 24x15 tiles far out on a wide screen, closer at mid and near', () => {
    expect(cropFor(cave, 'far', true)).toEqual({ w: 24, h: 15 })
    expect(cropFor(cave, 'mid', true)).toEqual({ w: 19, h: 12 })
    expect(cropFor(cave, 'near', true)).toEqual({ w: 15, h: 9 })
  })

  it('never shows more than the map, and still zooms in on a small one', () => {
    expect(cropFor(lab, 'far', true)).toEqual({ w: 15, h: 10 })
    expect(cropFor(lab, 'mid', true)).toEqual({ w: 12, h: 8 })
    expect(cropFor(lab, 'near', true)).toEqual({ w: 9, h: 6 })
  })

  it('is taller than wide on a phone', () => {
    expect(cropFor(cave, 'far', false)).toEqual({ w: 12, h: 15 })
    expect(cropFor(cave, 'near', false)).toEqual({ w: 7, h: 9 })
    expect(cropFor(lab, 'far', false)).toEqual({ w: 12, h: 10 })
  })

  it('reads an unknown zoom as far', () => {
    expect(cropFor(cave, 'nope', true)).toEqual(cropFor(cave, 'far', true))
  })
})

describe('cameraOn', () => {
  it('centers the hero and stops at the edges of the map', () => {
    const crop = { w: 24, h: 15 }
    expect(cameraOn(cave, { x: 16, y: 10 }, crop)).toEqual({ x: 4.5, y: 3 })
    expect(cameraOn(cave, { x: 0, y: 0 }, crop)).toEqual({ x: 0, y: 0 })
    expect(cameraOn(cave, { x: 31, y: 19 }, crop)).toEqual({ x: 8, y: 5 })
  })

  it('follows a hero between two tiles', () => {
    expect(cameraOn(cave, { x: 16.25, y: 10 }, { w: 24, h: 15 }).x).toBeCloseTo(4.75)
  })

  it('keeps the camera at 0 when the whole map fits', () => {
    expect(cameraOn(lab, { x: 12, y: 8 }, { w: 15, h: 10 })).toEqual({ x: 0, y: 0 })
  })
})

describe('tileAtPoint', () => {
  const box = { left: 100, top: 50, width: 480, height: 300 }

  it('maps a click to the tile under it through the camera', () => {
    // 24 tiles in 480px: 20px a tile. The camera starts at 4.5, 3.
    expect(tileAtPoint({ clientX: 110, clientY: 60 }, box, { x: 4.5, y: 3 }, { w: 24, h: 15 })).toEqual({ x: 5, y: 3 })
    expect(tileAtPoint({ clientX: 100, clientY: 50 }, box, { x: 4.5, y: 3 }, { w: 24, h: 15 })).toEqual({ x: 4, y: 3 })
    expect(tileAtPoint({ clientX: 579, clientY: 349 }, box, { x: 0, y: 0 }, { w: 24, h: 15 })).toEqual({ x: 23, y: 14 })
  })

  it('follows the zoom: fewer tiles in the same box are bigger', () => {
    // 15 tiles in 480px: 32px a tile.
    expect(tileAtPoint({ clientX: 100 + 70, clientY: 50 + 40 }, box, { x: 0, y: 0 }, { w: 15, h: 9 })).toEqual({ x: 2, y: 1 })
    expect(tileAtPoint({ clientX: 100 + 70, clientY: 50 + 40 }, box, { x: 10, y: 6 }, { w: 15, h: 9 })).toEqual({ x: 12, y: 7 })
  })

  it('ignores a point outside the picture or a box with no size', () => {
    expect(tileAtPoint({ clientX: 99, clientY: 60 }, box, { x: 0, y: 0 }, { w: 24, h: 15 })).toBeNull()
    expect(tileAtPoint({ clientX: 110, clientY: 350 }, box, { x: 0, y: 0 }, { w: 24, h: 15 })).toBeNull()
    expect(tileAtPoint({ clientX: 0, clientY: 0 }, { left: 0, top: 0, width: 0, height: 0 }, { x: 0, y: 0 }, { w: 24, h: 15 })).toBeNull()
  })
})

describe('heroPose', () => {
  it('alternates the two idle frames per step while walking, with a 1px bob on the second', () => {
    expect(heroPose({ walking: true, frame: 0, t: 0 })).toEqual({ pose: 'idle0', bob: 0 })
    expect(heroPose({ walking: true, frame: 1, t: 0 })).toEqual({ pose: 'idle1', bob: 1 })
  })

  it('breathes slowly and never bobs when standing', () => {
    expect(heroPose({ walking: false, frame: 1, t: 0.1 })).toEqual({ pose: 'idle0', bob: 0 })
    expect(heroPose({ walking: false, frame: 1, t: 0.6 })).toEqual({ pose: 'idle1', bob: 0 })
  })

  it('holds still with reduced motion', () => {
    expect(heroPose({ walking: true, frame: 1, t: 0.6, reduced: true })).toEqual({ pose: 'idle0', bob: 0 })
    expect(heroPose({ walking: false, frame: 0, t: 0.6, reduced: true })).toEqual({ pose: 'idle0', bob: 0 })
  })
})

it('faces left or right, and keeps the last side when walking up or down', () => {
  expect(sideOf('left', 1)).toBe(-1)
  expect(sideOf('right', -1)).toBe(1)
  expect(sideOf('up', -1)).toBe(-1)
  expect(sideOf('down', 1)).toBe(1)
  expect(sideOf('down')).toBe(1)
})

it('moves a point toward a target by at most a step, landing on it', () => {
  expect(approach({ x: 3, y: 10 }, { x: 4, y: 10 }, 0.25)).toEqual({ x: 3.25, y: 10 })
  expect(approach({ x: 3.9, y: 10 }, { x: 4, y: 10 }, 0.25)).toEqual({ x: 4, y: 10 })
  expect(approach({ x: 4, y: 10 }, { x: 4, y: 9 }, 2)).toEqual({ x: 4, y: 9 })
})

it('finds the rects of the zones still locked', () => {
  const open = new Set(['z2'])
  expect(lockedRects(cave, open)).toEqual([{ x: 22, y: 0, w: 10, h: 20 }])
  expect(lockedRects(lab, new Set())).toEqual([])
})

it('finds the portals that lead to a world still locked', () => {
  expect(lockedPortals(lab, stateWith())).toEqual([
    { x: 7, y: 1 },
    { x: 12, y: 1 },
    { x: 2, y: 8 },
    { x: 7, y: 8 },
    { x: 12, y: 8 },
  ])
  expect(lockedPortals(lab, stateWith({ codeSolved: 3 }))).not.toContainEqual({ x: 7, y: 1 })
  expect(lockedPortals(cave, stateWith({ codeSolved: 3 }))).toEqual([])
})

describe('fitCrop', () => {
  it('fills a wide stage with more columns of the map at the tile size its height allows', () => {
    // 1000x516: the 15 rows are 34.4px each, so 29 columns fill the width.
    expect(fitCrop(cave, 'far', { w: 24, h: 15 }, { width: 1000, height: 516 })).toEqual({ w: 29, h: 15, tile: 516 / 15 })
  })

  it('never shows more columns than the map has, nor fewer than the zoom asks', () => {
    expect(fitCrop(cave, 'far', { w: 24, h: 15 }, { width: 1470, height: 568 }).w).toBe(32)
    expect(fitCrop(cave, 'far', { w: 12, h: 15 }, { width: 335, height: 460 })).toEqual({ w: 12, h: 15, tile: 335 / 12 })
  })

  it('caps the tile at 3x its art far out and lets it grow with the zoom', () => {
    expect(fitCrop(lab, 'far', { w: 15, h: 10 }, { width: 1470, height: 568 })).toEqual({ w: 15, h: 10, tile: 48 })
    expect(fitCrop(cave, 'mid', { w: 19, h: 12 }, { width: 1470, height: 568 }).tile).toBeCloseTo(568 / 12)
    expect(fitCrop(cave, 'near', { w: 15, h: 9 }, { width: 1470, height: 568 }).tile).toBeCloseTo(568 / 9)
  })

  it('keeps the crop when the stage has not been measured', () => {
    expect(fitCrop(cave, 'far', { w: 24, h: 15 }, null)).toEqual({ w: 24, h: 15, tile: null })
  })
})
