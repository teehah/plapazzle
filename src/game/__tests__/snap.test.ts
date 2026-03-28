import { describe, it, expect } from 'vitest'
import { findSnapPosition } from '../snap'
import type { Cell } from '../../core/grid'

const board: Cell[] = [
  { row: 0, col: 0, dir: 0 },
  { row: 0, col: 1, dir: 0 },
  { row: 0, col: 2, dir: 0 },
  { row: 1, col: 0, dir: 0 },
  { row: 1, col: 1, dir: 0 },
  { row: 1, col: 2, dir: 0 },
]

describe('findSnapPosition', () => {
  it('空のボードに1セルピースをスナップできる', () => {
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const result = findSnapPosition(orientedCells, { x: 15, y: 15 }, board, [], 30, 'square')
    expect(result).not.toBeNull()
  })

  it('全セル占有済みならスナップできない', () => {
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const result = findSnapPosition(orientedCells, { x: 15, y: 15 }, board, [...board], 30, 'square')
    expect(result).toBeNull()
  })

  it('ボード外にはみ出す配置はスナップしない', () => {
    const orientedCells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
      { row: 0, col: 2, dir: 0 },
      { row: 0, col: 3, dir: 0 },  // col=3 はボード外
    ]
    const result = findSnapPosition(orientedCells, { x: 15, y: 15 }, board, [], 30, 'square')
    expect(result).toBeNull()
  })

  it('一部占有されていても空きセルにスナップできる', () => {
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const occupied: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
    ]
    // (0,2) は空いているので near (0,2) ドロップならスナップ可能
    const result = findSnapPosition(orientedCells, { x: 75, y: 15 }, board, occupied, 30, 'square')
    expect(result).not.toBeNull()
  })

  it('遠すぎる位置からはスナップしない', () => {
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const result = findSnapPosition(orientedCells, { x: 500, y: 500 }, board, [], 30, 'square')
    expect(result).toBeNull()
  })
})
