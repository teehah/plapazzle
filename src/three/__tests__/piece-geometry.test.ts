import { describe, it, expect } from 'vitest'
import { pieceToGeometry } from '../geometry'
import type { Cell } from '../../core/grid'

describe('pieceToGeometry (リム付きトレイ形状)', () => {
  const squareCells: Cell[] = [
    { row: 0, col: 0, dir: 0 },
    { row: 0, col: 1, dir: 0 },
    { row: 1, col: 0, dir: 0 },
    { row: 1, col: 1, dir: 0 },
  ]

  it('ジオメトリが生成される', () => {
    const geo = pieceToGeometry(squareCells, 30, 'square')
    expect(geo).toBeDefined()
    expect(geo.attributes.position).toBeDefined()
    expect(geo.attributes.position.count).toBeGreaterThan(0)
  })

  it('原点にセンタリングされている', () => {
    const geo = pieceToGeometry(squareCells, 30, 'square')
    geo.computeBoundingBox()
    const box = geo.boundingBox!
    const cx = (box.min.x + box.max.x) / 2
    const cy = (box.min.y + box.max.y) / 2
    expect(Math.abs(cx)).toBeLessThan(1)
    expect(Math.abs(cy)).toBeLessThan(1)
  })

  it('ジオメトリの XY 範囲がセル境界を超えない', () => {
    const geo = pieceToGeometry(squareCells, 30, 'square')
    geo.computeBoundingBox()
    const box = geo.boundingBox!
    // 2x2 の正方形、cellSize=30 → 60x60、center = 30,30 → 範囲 [-30,30]
    expect(box.min.x).toBeGreaterThanOrEqual(-30.1)
    expect(box.max.x).toBeLessThanOrEqual(30.1)
    expect(box.min.y).toBeGreaterThanOrEqual(-30.1)
    expect(box.max.y).toBeLessThanOrEqual(30.1)
  })

  it('Z方向に厚みがある（ベース+リム）', () => {
    const geo = pieceToGeometry(squareCells, 30, 'square')
    geo.computeBoundingBox()
    const box = geo.boundingBox!
    const zHeight = box.max.z - box.min.z
    expect(zHeight).toBeGreaterThan(5) // BASE_DEPTH + RIM_DEPTH
  })

  it('三角グリッドのピースでも生成できる', () => {
    const triCells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 0, dir: 1 },
      { row: 0, col: 1, dir: 0 },
      { row: 0, col: 1, dir: 1 },
      { row: 0, col: 2, dir: 0 },
      { row: 0, col: 2, dir: 1 },
    ]
    const geo = pieceToGeometry(triCells, 30, 'triangular')
    expect(geo.attributes.position.count).toBeGreaterThan(0)
  })

  it('L字ピースでもセル境界を超えない', () => {
    const lCells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 1, col: 0, dir: 0 },
      { row: 2, col: 0, dir: 0 },
      { row: 2, col: 1, dir: 0 },
    ]
    const geo = pieceToGeometry(lCells, 30, 'square')
    geo.computeBoundingBox()
    const box = geo.boundingBox!
    // L: 3 rows x 2 cols, cellSize=30 → 90x60, center (30, 45)
    // XY range: [-30, 30] x [-45, 45]
    expect(box.min.x).toBeGreaterThanOrEqual(-30.1)
    expect(box.max.x).toBeLessThanOrEqual(30.1)
    expect(box.min.y).toBeGreaterThanOrEqual(-45.1)
    expect(box.max.y).toBeLessThanOrEqual(45.1)
  })
})
