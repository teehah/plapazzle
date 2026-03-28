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
  const W = H * 2 / Math.sqrt(3)

  it('△(0,0)の3頂点を返す', () => {
    const pts = cellToSvgPoints({ row: 0, col: 0, dir: 0 }, H)
    // k = 2*0+0 = 0
    expect(pts[0]).toBeCloseTo2d([0, 0])
    expect(pts[1]).toBeCloseTo2d([W, 0])
    expect(pts[2]).toBeCloseTo2d([W/2, H])
  })
  it('▽(0,0)の3頂点を返す', () => {
    const pts = cellToSvgPoints({ row: 0, col: 0, dir: 1 }, H)
    // k = 2*0+0 = 0
    expect(pts[0]).toBeCloseTo2d([W, 0])
    expect(pts[1]).toBeCloseTo2d([W/2, H])
    expect(pts[2]).toBeCloseTo2d([3*W/2, H])
  })
  it('△(1,2)の3頂点はrow/colの斜交座標を反映する', () => {
    const pts = cellToSvgPoints({ row: 1, col: 2, dir: 0 }, H)
    // k = 2*1+2 = 4
    expect(pts[0]).toBeCloseTo2d([4*W/2, 2*H])
    expect(pts[1]).toBeCloseTo2d([6*W/2, 2*H])
    expect(pts[2]).toBeCloseTo2d([5*W/2, 3*H])
  })
  it('隣接セルはSVG上でエッジを共有する', () => {
    const cell = { row: 2, col: 3, dir: 0 as const }
    const pts = cellToSvgPoints(cell, H)
    const edges = [[pts[0], pts[1]], [pts[1], pts[2]], [pts[2], pts[0]]]

    for (const neighbor of neighbors(cell)) {
      const npts = cellToSvgPoints(neighbor, H)
      const nedges = [[npts[0], npts[1]], [npts[1], npts[2]], [npts[2], npts[0]]]

      let shared = false
      for (const e of edges) {
        for (const ne of nedges) {
          if ((close2d(e[0], ne[0]) && close2d(e[1], ne[1])) ||
              (close2d(e[0], ne[1]) && close2d(e[1], ne[0]))) {
            shared = true
          }
        }
      }
      expect(shared).toBe(true)
    }
  })
})

// ヘルパー
function close2d(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < 0.001 && Math.abs(a[1] - b[1]) < 0.001
}

function toBeCloseTo2d(received: [number, number], expected: [number, number]) {
  return {
    pass: close2d(received, expected),
    message: () => `expected ${JSON.stringify(received)} to be close to ${JSON.stringify(expected)}`
  }
}

expect.extend({ toBeCloseTo2d })
