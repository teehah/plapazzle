import { describe, it, expect } from 'vitest'
import { neighbors, cellToSvgPoints, cellKey } from '../grid'

interface CustomMatchers<R = unknown> {
  toBeCloseTo2d(expected: [number, number]): R
}
declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

describe('cellKey', () => {
  it('同じcellは同じキーを返す', () => {
    expect(cellKey({ row: 1, col: 2, dir: 0 })).toBe(cellKey({ row: 1, col: 2, dir: 0 }))
  })
  it('異なるcellは異なるキーを返す', () => {
    expect(cellKey({ row: 1, col: 2, dir: 0 })).not.toBe(cellKey({ row: 1, col: 2, dir: 1 }))
  })
})

describe('neighbors', () => {
  it('△(0,1)の隣は3つ', () => {
    const n = neighbors({ row: 0, col: 1, dir: 0 })
    expect(n).toHaveLength(3)
  })
  it('△(0,1)の右隣は▽(0,1)', () => {
    const n = neighbors({ row: 0, col: 1, dir: 0 })
    expect(n).toContainEqual({ row: 0, col: 1, dir: 1 })
  })
  it('△(0,1)の左隣は▽(0,0)', () => {
    const n = neighbors({ row: 0, col: 1, dir: 0 })
    expect(n).toContainEqual({ row: 0, col: 0, dir: 1 })
  })
  it('△(1,1)の上隣は▽(0,1)', () => {
    const n = neighbors({ row: 1, col: 1, dir: 0 })
    expect(n).toContainEqual({ row: 0, col: 1, dir: 1 })
  })
  it('▽(0,1)の左隣は△(0,1)', () => {
    const n = neighbors({ row: 0, col: 1, dir: 1 })
    expect(n).toContainEqual({ row: 0, col: 1, dir: 0 })
  })
  it('▽(0,1)の右隣は△(0,2)', () => {
    const n = neighbors({ row: 0, col: 1, dir: 1 })
    expect(n).toContainEqual({ row: 0, col: 2, dir: 0 })
  })
  it('▽(0,1)の下隣は△(1,1)', () => {
    const n = neighbors({ row: 0, col: 1, dir: 1 })
    expect(n).toContainEqual({ row: 1, col: 1, dir: 0 })
  })
})

describe('cellToSvgPoints', () => {
  const H = 10
  it('△(0,0)の3頂点を返す', () => {
    const pts = cellToSvgPoints({ row: 0, col: 0, dir: 0 }, H)
    const W = H * 2 / Math.sqrt(3)
    expect(pts[0]).toBeCloseTo2d([0, H])
    expect(pts[1]).toBeCloseTo2d([W/2, 0])
    expect(pts[2]).toBeCloseTo2d([W, H])
  })
  it('▽(0,0)の3頂点を返す', () => {
    const pts = cellToSvgPoints({ row: 0, col: 0, dir: 1 }, H)
    const W = H * 2 / Math.sqrt(3)
    expect(pts[0]).toBeCloseTo2d([0, 0])
    expect(pts[1]).toBeCloseTo2d([W, 0])
    expect(pts[2]).toBeCloseTo2d([W/2, H])
  })
})

// ヘルパー
function toBeCloseTo2d(received: [number, number], expected: [number, number]) {
  return {
    pass: Math.abs(received[0] - expected[0]) < 0.001 && Math.abs(received[1] - expected[1]) < 0.001,
    message: () => `expected ${JSON.stringify(received)} to be close to ${JSON.stringify(expected)}`
  }
}

expect.extend({ toBeCloseTo2d })
