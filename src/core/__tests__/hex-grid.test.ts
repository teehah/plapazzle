import { describe, it, expect } from 'vitest'
import { GRID_OPS } from '../grid-ops'
import type { Cell } from '../grid'

const hex = GRID_OPS.hexagonal

describe('hexagonal grid: neighbors', () => {
  it('(1,1)の隣は6つ', () => {
    const n = hex.neighbors({ row: 1, col: 1, dir: 0 })
    expect(n).toHaveLength(6)
  })
  it('6方向の隣接（オフセット座標）', () => {
    // offset座標系（偶数行基準）での6方向
    const n = hex.neighbors({ row: 2, col: 2, dir: 0 })
    expect(n).toHaveLength(6)
    // 全て異なるセル
    const keys = n.map(c => `${c.row},${c.col}`)
    expect(new Set(keys).size).toBe(6)
  })
})

describe('hexagonal grid: cellToSvgPoints', () => {
  const S = 20  // 六角形のサイズ
  it('(0,0)は6頂点を返す', () => {
    const pts = hex.cellToSvgPoints({ row: 0, col: 0, dir: 0 }, S)
    expect(pts).toHaveLength(6)
  })
  it('隣接セルは辺を共有する（2頂点が一致）', () => {
    const cell: Cell = { row: 2, col: 2, dir: 0 }
    const pts = hex.cellToSvgPoints(cell, S)
    for (const neighbor of hex.neighbors(cell)) {
      const npts = hex.cellToSvgPoints(neighbor, S)
      let sharedVertices = 0
      for (const p of pts) {
        for (const np of npts) {
          if (Math.abs(p[0] - np[0]) < 0.001 && Math.abs(p[1] - np[1]) < 0.001) {
            sharedVertices++
          }
        }
      }
      expect(sharedVertices).toBe(2)
    }
  })
})

describe('hexagonal grid: uniqueOrientations', () => {
  // 1セル → 1向き
  it('1セルは1向き', () => {
    const single: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    expect(hex.uniqueOrientations(single)).toHaveLength(1)
  })
  // 直線2セル → 3向き（60°回転で3方向、ミラーで同じ）
  it('直線2セルは3向き', () => {
    const line: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
    ]
    expect(hex.uniqueOrientations(line)).toHaveLength(3)
  })
})
