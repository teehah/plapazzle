import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { GRID_OPS } from '../core/grid-ops'
import type { PieceDef } from '../core/piece'
import type { Position, GridPosition } from './state'

/**
 * Returns the centroid world coordinate of a cell
 * by averaging its SVG polygon vertices.
 */
export function gridToWorld(cell: Cell, size: number, gridType: GridType): Position {
  const ops = GRID_OPS[gridType]
  const points = ops.cellToSvgPoints(cell, size)
  const x = points.reduce((sum, p) => sum + p[0], 0) / points.length
  const y = points.reduce((sum, p) => sum + p[1], 0) / points.length
  return { x, y }
}

/**
 * Returns the board cell whose centroid is closest
 * to the given world position, or null if boardCells is empty.
 */
export function worldToNearestGrid(
  wx: number,
  wy: number,
  size: number,
  gridType: GridType,
  boardCells: Cell[],
): Cell | null {
  if (boardCells.length === 0) return null

  let bestCell: Cell = boardCells[0]
  let bestDist = Infinity

  for (const cell of boardCells) {
    const centroid = gridToWorld(cell, size, gridType)
    const dx = centroid.x - wx
    const dy = centroid.y - wy
    const dist = dx * dx + dy * dy
    if (dist < bestDist) {
      bestDist = dist
      bestCell = cell
    }
  }

  return bestCell
}

/**
 * Returns the cell array for a specific orientation of a piece.
 * Uses GRID_OPS[gridType].uniqueOrientations() to get all orientations,
 * then indexes by orientationIndex % length.
 * When flipped is true, mirrors the cells first.
 */
export function getOrientedCells(
  piece: PieceDef,
  orientationIndex: number,
  flipped: boolean,
  gridType: GridType,
): Cell[] {
  const ops = GRID_OPS[gridType]
  // 回転: uniqueOrientations から選択（ミラー含まない回転のみ使用）
  const orientations = ops.uniqueOrientations(piece.cells)
  const idx = orientationIndex % orientations.length
  let cells = orientations[idx]

  // フリップ: 選択後にミラー適用
  if (flipped) {
    cells = cells.map(c => ops.mirror(c))
    // 正規化（min row/col を 0 に）
    const minRow = Math.min(...cells.map(c => c.row))
    const minCol = Math.min(...cells.map(c => c.col))
    cells = cells.map(c => ({ row: c.row - minRow, col: c.col - minCol, dir: c.dir }))
  }

  return cells
}

/**
 * Translates normalized cells by a grid position offset.
 */
export function getPlacedCells(
  orientedCells: Cell[],
  gridPosition: GridPosition,
): Cell[] {
  return orientedCells.map(c => ({
    row: c.row + gridPosition.row,
    col: c.col + gridPosition.col,
    dir: c.dir,
  }))
}
