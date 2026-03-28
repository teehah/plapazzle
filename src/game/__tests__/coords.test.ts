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
    expect(c.x).toBeCloseTo(30) // avg(15, 45) = 30
    expect(c.y).toBeCloseTo(15)
  })
})

describe('worldToSvgDrop', () => {
  // boardOffset for a 2x3 square board (rows 0-1, cols 0-2, cellSize=30):
  // SVG x: 0..90, y: 0..60
  // Three.js geometry: x: 0..90, y: -60..0
  // boardOffset = { x: 45, y: -30 }
  const boardOffset = { x: 45, y: -30 }

  it('ピースをボード中心にドロップした場合、SVG座標がボード中心に近い', () => {
    // ピースが world origin にある場合（ボードはboard meshにより原点にセンタリング済み）
    // ピースの oriented cells の SVG centroid が (15, 15)
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    // mesh が (-boardOffset.x, -boardOffset.y) = (-45, 30) に位置する場合、
    // ピースの (0,0) セルがボードの (0,0) セルと重なる
    const drop = worldToSvgDrop(
      { x: -45, y: 30 }, // mesh position (= -boardOffset)
      orientedCells,
      30,
      'square',
      boardOffset,
    )
    // ピースの visual center は SVG (15, 15)
    expect(drop.x).toBeCloseTo(15)
    expect(drop.y).toBeCloseTo(15)
  })

  it('ジオメトリオフセットを含めないと間違ったSVG座標になる', () => {
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    // mesh position = (0, 0) → piece visual center is NOT at SVG (45, 30)
    // Without geometry offset: SVG = (0 + 45, -(0 + (-30))) = (45, 30) ← board center
    // With geometry offset: SVG = (15 + 0 + 45, ...) = (60, ...) ← shifted by cell centroid
    const drop = worldToSvgDrop(
      { x: 0, y: 0 },
      orientedCells,
      30,
      'square',
      boardOffset,
    )
    // SVG drop should reflect that the piece geometry has its own extent
    // NOT just boardOffset
    // svgX = geoCenterSvgX + pos.x + boardOffset.x = 15 + 0 + 45 = 60
    expect(drop.x).toBeCloseTo(60)
    // svgY = -((-geoCenterSvgY + pos.y) + boardOffset.y) = -((-15 + 0) + (-30)) = 45
    expect(drop.y).toBeCloseTo(45)
  })
})

describe('svgSnapToWorld', () => {
  const boardOffset = { x: 45, y: -30 }

  it('スナップ後のワールド座標がボードと整列する', () => {
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const snapGridPos = { row: 0, col: 0 }

    const worldPos = svgSnapToWorld(
      orientedCells,
      snapGridPos,
      30,
      'square',
      boardOffset,
    )

    // ピースの (0,0) セルが ボードの (0,0) セルと重なる位置
    // ボードの (0,0) セルの SVG centroid = (15, 15)
    // ボードの (0,0) セルの world pos = (15 - 45, -15 - (-30)) = (-30, 15)
    // ピースの (0,0) セルの geometry centroid = (15, -15) (in Three.js local)
    // worldPos + geometry centroid = board cell world pos
    // worldPos.x + 15 = -30 → worldPos.x = -45
    // worldPos.y + (-15) = 15 → worldPos.y = 30
    expect(worldPos.x).toBeCloseTo(-45)
    expect(worldPos.y).toBeCloseTo(30)
  })

  it('別のグリッド位置にスナップした場合も整列する', () => {
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const snapGridPos = { row: 1, col: 2 }

    const worldPos = svgSnapToWorld(
      orientedCells,
      snapGridPos,
      30,
      'square',
      boardOffset,
    )

    // placed cell = (1, 2) → SVG centroid = (75, 45)
    // board world = (75 - 45, -45 - (-30)) = (30, -15)
    // geometry centroid of oriented (0,0) = (15, -15) in Three.js
    // worldPos.x + 15 = 30 → worldPos.x = 15
    // worldPos.y + (-15) = -15 → worldPos.y = 0
    expect(worldPos.x).toBeCloseTo(15)
    expect(worldPos.y).toBeCloseTo(0)
  })
})
