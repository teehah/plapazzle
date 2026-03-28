/**
 * Three.js ワールド座標 ↔ SVG座標の変換ヘルパー。
 *
 * 座標系の関係:
 * - SVG: (sx, sy) — Y が下に増加
 * - Three.js geometry: (sx, -sy) — geometry.ts が Y を反転して Shape を作る
 * - Three.js world: geometry + mesh.position + board centering offset
 *
 * BoardMesh は geometry を bounding box 中心でセンタリングする（boardOffset）。
 * PieceMesh はセンタリングしない（geometry がそのまま使われる）。
 * そのため、ピースの mesh.position はピースの視覚的中心ではなく、
 * ジオメトリ原点のオフセットを含む。
 */
import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import type { Position, GridPosition } from './state'
import { gridToWorld, getPlacedCells } from './placement'

/**
 * セル配列の SVG 座標系での重心を返す。
 */
export function svgCentroid(
  cells: Cell[],
  cellSize: number,
  gridType: GridType,
): Position {
  const positions = cells.map(c => gridToWorld(c, cellSize, gridType))
  return {
    x: positions.reduce((s, p) => s + p.x, 0) / positions.length,
    y: positions.reduce((s, p) => s + p.y, 0) / positions.length,
  }
}

/**
 * ピースの Three.js mesh position から、findSnapPosition に渡す
 * SVG ドロップ座標を計算する。
 *
 * ピースの視覚的中心（ジオメトリの重心）を考慮する。
 */
export function worldToSvgDrop(
  meshPosition: Position,
  orientedCells: Cell[],
  cellSize: number,
  gridType: GridType,
  boardOffset: Position,
): Position {
  const geoCenter = svgCentroid(orientedCells, cellSize, gridType)

  // ピースの visual center in Three.js world:
  //   worldCenterX = geoCenter.x + meshPosition.x   (geo local x = svgX)
  //   worldCenterY = -geoCenter.y + meshPosition.y   (geo local y = -svgY)
  //
  // World → SVG 変換 (board centering の逆変換):
  //   svgX = worldX + boardOffset.x
  //   svgY = -(worldY + boardOffset.y)

  const worldCenterX = geoCenter.x + meshPosition.x
  const worldCenterY = -geoCenter.y + meshPosition.y

  return {
    x: worldCenterX + boardOffset.x,
    y: -(worldCenterY + boardOffset.y),
  }
}

/**
 * スナップ後の Three.js mesh position を計算する。
 *
 * orientedCells を snapGridPos に配置した時、ボードと整列する
 * mesh position を返す。
 */
export function svgSnapToWorld(
  orientedCells: Cell[],
  snapGridPos: GridPosition,
  cellSize: number,
  gridType: GridType,
  boardOffset: Position,
): Position {
  const placedCells = getPlacedCells(orientedCells, snapGridPos)
  const placedCenter = svgCentroid(placedCells, cellSize, gridType)
  const orientedCenter = svgCentroid(orientedCells, cellSize, gridType)

  // placed cells の SVG 重心 → world:
  //   boardWorldX = placedCenter.x - boardOffset.x
  //   boardWorldY = -placedCenter.y - boardOffset.y
  //
  // oriented cells のジオメトリ重心(Three.js local):
  //   geoLocalX = orientedCenter.x
  //   geoLocalY = -orientedCenter.y
  //
  // mesh.position + geoLocal = boardWorld なので:
  //   pos.x = boardWorldX - geoLocalX
  //   pos.y = boardWorldY - geoLocalY

  return {
    x: (placedCenter.x - boardOffset.x) - orientedCenter.x,
    y: (-placedCenter.y - boardOffset.y) - (-orientedCenter.y),
  }
}
