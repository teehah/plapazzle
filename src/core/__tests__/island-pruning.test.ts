import { describe, it, expect } from 'vitest'
import { hasDeadIsland } from '../island-pruning'
import type { Cell } from '../grid'
import { GRID_OPS } from '../grid-ops'

const sq = GRID_OPS.square

describe('hasDeadIsland', () => {
  // 正方形グリッドで、ピースサイズ5のとき

  it('全セルが連結でサイズが5の倍数なら false', () => {
    // 2x5 = 10セル、5の倍数、全連結
    const cells: Cell[] = []
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 5; c++)
        cells.push({ row: r, col: c, dir: 0 })
    expect(hasDeadIsland(cells, sq.neighbors, 5)).toBe(false)
  })

  it('連結だがサイズが5の倍数でなければ true', () => {
    // 3セル（5の倍数でない）
    const cells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
      { row: 0, col: 2, dir: 0 },
    ]
    expect(hasDeadIsland(cells, sq.neighbors, 5)).toBe(true)
  })

  it('2つの連結成分があり片方が5の倍数でなければ true', () => {
    // 5セル + 3セルに分離
    const cells: Cell[] = [
      // 連結成分1: 5セル
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
      { row: 0, col: 2, dir: 0 },
      { row: 0, col: 3, dir: 0 },
      { row: 0, col: 4, dir: 0 },
      // 連結成分2: 3セル（分離）
      { row: 2, col: 0, dir: 0 },
      { row: 2, col: 1, dir: 0 },
      { row: 2, col: 2, dir: 0 },
    ]
    expect(hasDeadIsland(cells, sq.neighbors, 5)).toBe(true)
  })

  it('2つの連結成分が両方5の倍数なら false', () => {
    const cells: Cell[] = [
      // 5セル
      { row: 0, col: 0, dir: 0 }, { row: 0, col: 1, dir: 0 },
      { row: 0, col: 2, dir: 0 }, { row: 0, col: 3, dir: 0 },
      { row: 0, col: 4, dir: 0 },
      // 5セル（分離）
      { row: 2, col: 0, dir: 0 }, { row: 2, col: 1, dir: 0 },
      { row: 2, col: 2, dir: 0 }, { row: 2, col: 3, dir: 0 },
      { row: 2, col: 4, dir: 0 },
    ]
    expect(hasDeadIsland(cells, sq.neighbors, 5)).toBe(false)
  })

  it('空セルリストなら false', () => {
    expect(hasDeadIsland([], sq.neighbors, 5)).toBe(false)
  })
})
