import type { Cell } from '../core/grid'
import { cellKey } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import type { Position, GridPosition } from './state'
import { gridToWorld, worldToNearestGrid, getPlacedCells } from './placement'

/**
 * Find a valid snap position for a piece being dropped on the board.
 *
 * 1. Find all board cells within threshold distance of dropPosition
 * 2. For each nearby cell, try each oriented cell as reference
 * 3. Check if the resulting placement is fully on-board and non-overlapping
 * 4. Among valid placements, return the one closest to the drop position
 */
export function findSnapPosition(
  orientedCells: Cell[],
  dropPosition: Position,
  boardCells: Cell[],
  occupiedCells: Cell[],
  cellSize: number,
  gridType: GridType,
): GridPosition | null {
  if (boardCells.length === 0) return null

  const threshold = cellSize * 1.5
  const thresholdSq = threshold * threshold

  // Find all board cells within threshold
  const nearbyCells: { cell: Cell; distSq: number }[] = []
  for (const cell of boardCells) {
    const center = gridToWorld(cell, cellSize, gridType)
    const dx = center.x - dropPosition.x
    const dy = center.y - dropPosition.y
    const distSq = dx * dx + dy * dy
    if (distSq <= thresholdSq) {
      nearbyCells.push({ cell, distSq })
    }
  }

  if (nearbyCells.length === 0) return null

  // Sort by distance (try closest first)
  nearbyCells.sort((a, b) => a.distSq - b.distSq)

  const boardSet = new Set(boardCells.map(cellKey))
  const occupiedSet = new Set(occupiedCells.map(cellKey))

  // Track tried offsets to avoid duplicates
  const triedOffsets = new Set<string>()

  for (const { cell: nearbyCell } of nearbyCells) {
    for (const refCell of orientedCells) {
      const offset: GridPosition = {
        row: nearbyCell.row - refCell.row,
        col: nearbyCell.col - refCell.col,
      }

      const offsetKey = `${offset.row},${offset.col}`
      if (triedOffsets.has(offsetKey)) continue
      triedOffsets.add(offsetKey)

      const placed = getPlacedCells(orientedCells, offset)

      const allValid = placed.every(c => {
        const key = cellKey(c)
        return boardSet.has(key) && !occupiedSet.has(key)
      })

      if (allValid) {
        return offset
      }
    }
  }

  return null
}
