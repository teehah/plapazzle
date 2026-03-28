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

  it('最寄りセルが占有済みでも、近隣の空きセルにスナップできる', () => {
    // ドロップ位置は (0,0) の重心 (15,15) に最も近い
    // しかし (0,0) は占有済み → 近隣の (0,1) や (1,0) にスナップすべき
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const occupied: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const result = findSnapPosition(orientedCells, { x: 15, y: 15 }, board, occupied, 30, 'square')
    expect(result).not.toBeNull()
    // スナップ先は (0,0) 以外の空きセル
    expect(result!.row + result!.col).toBeGreaterThan(0)
  })

  it('複数セルピースで最寄りセルでは配置不可でも近隣で配置可能ならスナップする', () => {
    // 横3セルのピース。ドロップ位置は (0,2) の重心近く。
    // 最寄りセルが (0,2) の場合、refCell=(0,0) でオフセット (0,2) を試すと
    // placed = (0,2),(0,3),(0,4) — col=3,4 はボード外で失敗。
    // しかし refCell=(0,2) でオフセット (0,0) なら placed = (0,0),(0,1),(0,2) で成功。
    // これが見つかるべき。
    const orientedCells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
      { row: 0, col: 2, dir: 0 },
    ]
    // ドロップ位置を (0,2) セルの重心: (75, 15)
    const result = findSnapPosition(orientedCells, { x: 75, y: 15 }, board, [], 30, 'square')
    expect(result).not.toBeNull()
  })

  it('ドロップ位置がセル間でも最適な配置を見つける', () => {
    // ドロップが (0,1) と (1,1) の間 — 重心 y=30 (境界上)
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const result = findSnapPosition(orientedCells, { x: 45, y: 30 }, board, [], 30, 'square')
    expect(result).not.toBeNull()
  })
})
