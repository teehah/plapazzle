/**
 * Three.js ワールド座標 ↔ SVG座標の変換ヘルパー。
 *
 * 座標系の関係:
 * - SVG: (sx, sy) — Y が下に増加
 * - Three.js geometry: (sx, -sy) — geometry.ts が Y を反転して Shape を作る
 * - Three.js world: geometry + mesh.position + board/piece centering offset
 *
 * BoardMesh と PieceMesh の両方がジオメトリをセンタリングしている。
 * mesh.position がそのままピースの視覚的中心を表す。
 *
 * Board centering offset (boardOffset):
 *   ボードジオメトリの bounding box 中心。ボードが原点にセンタリングされる。
 *
 * 変換:
 *   SVG (sx, sy) → Three.js world:
 *     worldX = sx - boardOffset.x
 *     worldY = -sy - boardOffset.y
 *
 *   Three.js world → SVG:
 *     svgX = worldX + boardOffset.x
 *     svgY = -(worldY + boardOffset.y)
 */
import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import type { Position, GridPosition } from './state'
import { svgBboxCenter } from './bbox'
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
 * PieceMesh はジオメトリがセンタリングされているので、
 * mesh.position = 視覚的中心 = ジオメトリ重心のワールド座標。
 */
export function worldToSvgDrop(
  meshPosition: Position,
  _orientedCells: Cell[],
  _cellSize: number,
  _gridType: GridType,
  boardOffset: Position,
): Position {
  // mesh.position はピースの視覚的中心（センタリング済み）
  // World → SVG: svgX = worldX + boardOffset.x, svgY = -(worldY + boardOffset.y)
  return {
    x: meshPosition.x + boardOffset.x,
    y: -(meshPosition.y + boardOffset.y),
  }
}

/**
 * スナップ後の Three.js mesh position を計算する。
 *
 * orientedCells を snapGridPos に配置した時、ボードと整列する
 * mesh position を返す。
 *
 * cellsToGeometry は SVG 頂点の bounding box 中心でセンタリングするので、
 * mesh.position = placedCells の SVG bbox 中心のワールド座標。
 */
export function svgSnapToWorld(
  orientedCells: Cell[],
  snapGridPos: GridPosition,
  cellSize: number,
  gridType: GridType,
  boardOffset: Position,
): Position {
  const placedCells = getPlacedCells(orientedCells, snapGridPos)
  const placedCenter = svgBboxCenter(placedCells, cellSize, gridType)

  // SVG bbox center → world: worldX = svgX - boardOffset.x, worldY = -svgY - boardOffset.y
  return {
    x: placedCenter.x - boardOffset.x,
    y: -placedCenter.y - boardOffset.y,
  }
}
