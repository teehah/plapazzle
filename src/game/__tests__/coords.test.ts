import { describe, it, expect } from 'vitest'
import { svgCentroid, worldToSvgDrop, svgSnapToWorld } from '../coords'
import type { Cell } from '../../core/grid'

describe('svgCentroid', () => {
  it('正方形グリッドの (0,0) セルの重心を返す', () => {
    const cells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const c = svgCentroid(cells, 30, 'square')
    expect(c.x).toBeCloseTo(15)
    expect(c.y).toBeCloseTo(15)
  })

  it('2セルの重心を返す', () => {
    const cells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
    ]
    const c = svgCentroid(cells, 30, 'square')
    expect(c.x).toBeCloseTo(30) // avg(15, 45)
    expect(c.y).toBeCloseTo(15)
  })
})

describe('worldToSvgDrop (centered PieceMesh)', () => {
  // Board: 2x3 square grid (rows 0-1, cols 0-2, cellSize=30)
  // SVG extent: x 0..90, y 0..60
  // Three.js geometry: x 0..90, y -60..0
  // boardOffset = { x: 45, y: -30 }
  const boardOffset = { x: 45, y: -30 }

  it('mesh.position = ピースの視覚的中心として SVG 座標を返す', () => {
    // PieceMesh がセンタリングされているので、mesh.position が視覚的中心。
    // ピースが原点にあれば SVG 座標はボード中心。
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const drop = worldToSvgDrop({ x: 0, y: 0 }, orientedCells, 30, 'square', boardOffset)
    // svgX = 0 + 45 = 45 (ボード中心 x)
    // svgY = -(0 + (-30)) = 30 (ボード中心 y)
    expect(drop.x).toBeCloseTo(45)
    expect(drop.y).toBeCloseTo(30)
  })

  it('ボード左上のセルに対応する位置', () => {
    // セル(0,0) の SVG centroid = (15, 15)
    // ワールド座標 = (15 - 45, -15 - (-30)) = (-30, 15)
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const drop = worldToSvgDrop({ x: -30, y: 15 }, orientedCells, 30, 'square', boardOffset)
    expect(drop.x).toBeCloseTo(15)
    expect(drop.y).toBeCloseTo(15)
  })
})

describe('svgSnapToWorld (centered PieceMesh)', () => {
  const boardOffset = { x: 45, y: -30 }

  it('スナップ後のワールド座標がボードセルの中心に一致する', () => {
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const snapGridPos = { row: 0, col: 0 }

    const worldPos = svgSnapToWorld(orientedCells, snapGridPos, 30, 'square', boardOffset)

    // placed cell (0,0) SVG centroid = (15, 15)
    // world = (15 - 45, -15 - (-30)) = (-30, 15)
    expect(worldPos.x).toBeCloseTo(-30)
    expect(worldPos.y).toBeCloseTo(15)
  })

  it('別のグリッド位置にスナップしても整列する', () => {
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const snapGridPos = { row: 1, col: 2 }

    const worldPos = svgSnapToWorld(orientedCells, snapGridPos, 30, 'square', boardOffset)

    // placed cell (1,2) SVG centroid = (75, 45)
    // world = (75 - 45, -45 - (-30)) = (30, -15)
    expect(worldPos.x).toBeCloseTo(30)
    expect(worldPos.y).toBeCloseTo(-15)
  })

  it('複数セルピースの重心がスナップ位置になる', () => {
    const orientedCells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
    ]
    const snapGridPos = { row: 0, col: 0 }

    const worldPos = svgSnapToWorld(orientedCells, snapGridPos, 30, 'square', boardOffset)

    // placed cells (0,0) and (0,1): SVG centroids (15,15) and (45,15), avg = (30, 15)
    // world = (30 - 45, -15 - (-30)) = (-15, 15)
    expect(worldPos.x).toBeCloseTo(-15)
    expect(worldPos.y).toBeCloseTo(15)
  })
})
