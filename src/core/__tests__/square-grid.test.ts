import { describe, it, expect } from 'vitest'
import { GRID_OPS } from '../grid-ops'
import type { Cell } from '../grid'

const sq = GRID_OPS.square

describe('square grid: neighbors', () => {
  it('(1,1)の隣は4つ', () => {
    const n = sq.neighbors({ row: 1, col: 1, dir: 0 })
    expect(n).toHaveLength(4)
  })
  it('上下左右の4方向', () => {
    const n = sq.neighbors({ row: 2, col: 3, dir: 0 })
    expect(n).toContainEqual({ row: 1, col: 3, dir: 0 })
    expect(n).toContainEqual({ row: 3, col: 3, dir: 0 })
    expect(n).toContainEqual({ row: 2, col: 2, dir: 0 })
    expect(n).toContainEqual({ row: 2, col: 4, dir: 0 })
  })
})

describe('square grid: cellToSvgPoints', () => {
  const S = 20
  it('(0,0)は原点から始まる正方形', () => {
    const pts = sq.cellToSvgPoints({ row: 0, col: 0, dir: 0 }, S)
    expect(pts).toHaveLength(4)
    expect(pts[0]).toEqual([0, 0])
    expect(pts[1]).toEqual([S, 0])
    expect(pts[2]).toEqual([S, S])
    expect(pts[3]).toEqual([0, S])
  })
  it('(1,2)は正しい位置', () => {
    const pts = sq.cellToSvgPoints({ row: 1, col: 2, dir: 0 }, S)
    expect(pts[0]).toEqual([2 * S, 1 * S])
    expect(pts[1]).toEqual([3 * S, 1 * S])
    expect(pts[2]).toEqual([3 * S, 2 * S])
    expect(pts[3]).toEqual([2 * S, 2 * S])
  })
  it('隣接セルは辺を共有する', () => {
    const cell: Cell = { row: 1, col: 1, dir: 0 }
    const pts = sq.cellToSvgPoints(cell, S)
    for (const neighbor of sq.neighbors(cell)) {
      const npts = sq.cellToSvgPoints(neighbor, S)
      let sharedVertices = 0
      for (const p of pts) {
        for (const np of npts) {
          if (p[0] === np[0] && p[1] === np[1]) sharedVertices++
        }
      }
      expect(sharedVertices).toBe(2)
    }
  })
})

describe('square grid: uniqueOrientations', () => {
  // I-テトロミノ: 横一列4セル → 回転で2向き
  it('直線4セルは2向き', () => {
    const line: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
      { row: 0, col: 2, dir: 0 },
      { row: 0, col: 3, dir: 0 },
    ]
    expect(sq.uniqueOrientations(line)).toHaveLength(2)
  })
  // O-テトロミノ: 2x2正方形 → 1向き
  it('2x2正方形は1向き', () => {
    const square: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
      { row: 1, col: 0, dir: 0 },
      { row: 1, col: 1, dir: 0 },
    ]
    expect(sq.uniqueOrientations(square)).toHaveLength(1)
  })
  // T-テトロミノ → 4向き
  it('T字は4向き', () => {
    const t: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
      { row: 0, col: 2, dir: 0 },
      { row: 1, col: 1, dir: 0 },
    ]
    expect(sq.uniqueOrientations(t)).toHaveLength(4)
  })
  // F-ペントミノ（非対称）→ 8向き
  it('F字（非対称）は8向き', () => {
    const f: Cell[] = [
      { row: 0, col: 1, dir: 0 },
      { row: 0, col: 2, dir: 0 },
      { row: 1, col: 0, dir: 0 },
      { row: 1, col: 1, dir: 0 },
      { row: 2, col: 1, dir: 0 },
    ]
    expect(sq.uniqueOrientations(f)).toHaveLength(8)
  })
})
