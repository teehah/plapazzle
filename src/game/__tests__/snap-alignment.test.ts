/**
 * 非対称ピース（L字等）のスナップ位置がグリッドと正確に整列することを検証。
 *
 * cellsToGeometry は SVG 頂点の bbox center でセンタリングする。
 * svgSnapToWorld も同じ bbox center を使わなければグリッドズレが発生する。
 */
import { describe, it, expect } from 'vitest'
import { svgBboxCenter, svgSnapToWorld } from '../coords'
import { getPlacedCells } from '../placement'
import { GRID_OPS } from '../../core/grid-ops'
import type { Cell } from '../../core/grid'

const CELL_SIZE = 30

function c(row: number, col: number): Cell {
  return { row, col, dir: 0 }
}

/**
 * cellsToGeometry と同じセンタリング: SVG 頂点の bbox center
 */
function geometryCenter(cells: Cell[], cellSize: number) {
  const ops = GRID_OPS['square']
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const cell of cells) {
    const pts = ops.cellToSvgPoints(cell, cellSize)
    for (const [px, py] of pts) {
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      // geometry: y = -svgY
      if (-py < minY) minY = -py
      if (-py > maxY) maxY = -py
    }
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}

// ボード: 5x8 の正方形グリッド
const board: Cell[] = []
for (let r = 0; r < 5; r++) {
  for (let c = 0; c < 8; c++) {
    board.push({ row: r, col: c, dir: 0 })
  }
}

// boardOffset = ボードジオメトリの bbox center
const boardGeoCenter = geometryCenter(board, CELL_SIZE)

describe('snap alignment (bbox center)', () => {
  const pieces = {
    L: [c(0,0), c(1,0), c(2,0), c(2,1)],
    T: [c(0,0), c(0,1), c(0,2), c(1,1)],
    S: [c(0,1), c(0,2), c(1,0), c(1,1)],
    I: [c(0,0), c(0,1), c(0,2), c(0,3)],
    O: [c(0,0), c(0,1), c(1,0), c(1,1)],
  }

  for (const [name, cells] of Object.entries(pieces)) {
    it(`${name}字ピースがグリッドに正確に整列する`, () => {
      const gridPos = { row: 1, col: 2 }
      const placed = getPlacedCells(cells, gridPos)

      // svgSnapToWorld で得たワールド座標
      const worldPos = svgSnapToWorld(cells, gridPos, CELL_SIZE, 'square', boardGeoCenter)

      // ピースのワールド座標 + ボードオフセット = ジオメトリセンター（SVG→world変換を逆算）

      // 直接比較: ピースの mesh.position にジオメトリを置いた時の bbox center が
      // ボードの対応セルの bbox center と一致するか
      const pieceBboxSvg = svgBboxCenter(placed, CELL_SIZE, 'square')

      // world → SVG 逆変換: svgX = worldX + boardOffset.x, svgY = -(worldY + boardOffset.y)
      const meshSvgX = worldPos.x + boardGeoCenter.x
      const meshSvgY = -(worldPos.y + boardGeoCenter.y)

      expect(meshSvgX).toBeCloseTo(pieceBboxSvg.x, 5)
      expect(meshSvgY).toBeCloseTo(pieceBboxSvg.y, 5)
    })
  }

  it('L字ピースの bbox center はセル重心と異なる', () => {
    // この差がグリッドズレの原因だった
    const L = [c(0,0), c(1,0), c(2,0), c(2,1)]
    const bbox = svgBboxCenter(L, CELL_SIZE, 'square')
    // SVG bbox center: x=(0+60)/2=30, y=(0+90)/2=45
    expect(bbox.x).toBe(30)
    expect(bbox.y).toBe(45)

    // セル重心: ((15+15+15+45)/4, (15+45+75+75)/4) = (22.5, 52.5)
    // これらが一致しないことを確認
    expect(bbox.x).not.toBe(22.5)
    expect(bbox.y).not.toBe(52.5)
  })

  it('O字ピース（対称）では bbox center = セル重心', () => {
    const O = [c(0,0), c(0,1), c(1,0), c(1,1)]
    const bbox = svgBboxCenter(O, CELL_SIZE, 'square')
    // SVG bbox center: x=(0+60)/2=30, y=(0+60)/2=30
    // セル重心: ((15+45+15+45)/4, (15+15+45+45)/4) = (30, 30)
    expect(bbox.x).toBe(30)
    expect(bbox.y).toBe(30)
  })
})
