import type { Cell } from '../core/grid'
import { cellKey } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import type { Position, GridPosition } from './state'
import { gridToWorld, worldToNearestGrid, getPlacedCells } from './placement'

/**
 * Find a valid snap position for a piece being dropped on the board.
 *
 * 1. Find the nearest board cell to dropPosition
 * 2. Check if distance is within threshold (cellSize * 1.5)
 * 3. Try each cell in orientedCells as the reference cell aligned to nearestCell
 * 4. For each candidate offset: translate all orientedCells by that offset
 * 5. Check if ALL translated cells are on the board AND not in occupiedCells
 * 6. Return the first valid GridPosition, or null if none found
 */
export function findSnapPosition(
  orientedCells: Cell[],
  dropPosition: Position,
  boardCells: Cell[],
  occupiedCells: Cell[],
  cellSize: number,
  gridType: GridType,
): GridPosition | null {
  // 1. Find nearest board cell to drop position
  const nearestCell = worldToNearestGrid(
    dropPosition.x,
    dropPosition.y,
    cellSize,
    gridType,
    boardCells,
  )
  if (nearestCell === null) return null

  // 2. Check if distance is within threshold
  const nearestWorld = gridToWorld(nearestCell, cellSize, gridType)
  const dx = nearestWorld.x - dropPosition.x
  const dy = nearestWorld.y - dropPosition.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const threshold = cellSize * 1.5
  if (dist > threshold) return null

  // Build lookup sets for fast membership checks
  const boardSet = new Set(boardCells.map(cellKey))
  const occupiedSet = new Set(occupiedCells.map(cellKey))

  // 3. Try each cell in orientedCells as the reference cell aligned to nearestCell
  for (const refCell of orientedCells) {
    // The offset that aligns refCell to nearestCell
    const offset: GridPosition = {
      row: nearestCell.row - refCell.row,
      col: nearestCell.col - refCell.col,
    }

    // 4. Translate all orientedCells by that offset
    const placed = getPlacedCells(orientedCells, offset)

    // 5. Check if ALL translated cells are on the board AND not occupied
    const allValid = placed.every(c => {
      const key = cellKey(c)
      return boardSet.has(key) && !occupiedSet.has(key)
    })

    if (allValid) {
      // 6. Return the first valid GridPosition
      return offset
    }
  }

  return null
}
