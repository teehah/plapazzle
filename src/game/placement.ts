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
  const baseCells = flipped
    ? piece.cells.map(c => ({ row: c.row, col: -c.col, dir: c.dir }))
    : piece.cells
  const orientations = ops.uniqueOrientations(baseCells)
  const idx = orientationIndex % orientations.length
  return orientations[idx]
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
