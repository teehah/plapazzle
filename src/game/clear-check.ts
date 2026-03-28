import type { Cell } from '../core/grid'
import { cellKey } from '../core/grid'

export function checkCleared(boardCells: Cell[], coveredCells: Cell[]): boolean {
  const coveredSet = new Set(coveredCells.map(cellKey))
  return boardCells.every(c => coveredSet.has(cellKey(c)))
}
