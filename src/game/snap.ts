import type { Cell } from '../core/grid'
import { cellKey } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { GRID_OPS } from '../core/grid-ops'
import type { Position, GridPosition } from './state'
import { gridToWorld, getPlacedCells } from './placement'

/**
 * ボードの SVG bounding box を計算する。
 */
function boardBoundingBox(
  boardCells: Cell[],
  cellSize: number,
  gridType: GridType,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const ops = GRID_OPS[gridType]
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const cell of boardCells) {
    const pts = ops.cellToSvgPoints(cell, cellSize)
    for (const [x, y] of pts) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return { minX, maxX, minY, maxY }
}

/**
 * Find a valid snap position for a piece being dropped on the board.
 *
 * ルール: ドロップ重心がボード領域内にあれば、必ず有効な配置にスナップする。
 * ボード領域外であればスナップしない。
 *
 * 全有効配置の中から、ドロップ位置に最も近いものを返す。
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

  // ドロップ重心がボードの bounding box 内にあるか判定
  const bbox = boardBoundingBox(boardCells, cellSize, gridType)
  const margin = cellSize * 0.1  // ごくわずかなマージン
  if (
    dropPosition.x < bbox.minX - margin ||
    dropPosition.x > bbox.maxX + margin ||
    dropPosition.y < bbox.minY - margin ||
    dropPosition.y > bbox.maxY + margin
  ) {
    return null
  }

  // ピースの座標範囲
  const pieceMinRow = Math.min(...orientedCells.map(c => c.row))
  const pieceMaxRow = Math.max(...orientedCells.map(c => c.row))
  const pieceMinCol = Math.min(...orientedCells.map(c => c.col))
  const pieceMaxCol = Math.max(...orientedCells.map(c => c.col))

  // ボードの座標範囲
  const boardMinRow = Math.min(...boardCells.map(c => c.row))
  const boardMaxRow = Math.max(...boardCells.map(c => c.row))
  const boardMinCol = Math.min(...boardCells.map(c => c.col))
  const boardMaxCol = Math.max(...boardCells.map(c => c.col))

  const boardSet = new Set(boardCells.map(cellKey))
  const occupiedSet = new Set(occupiedCells.map(cellKey))

  // 全有効オフセットを列挙し、ドロップ位置に最も近いものを選ぶ
  let bestOffset: GridPosition | null = null
  let bestDistSq = Infinity

  const rowMin = boardMinRow - pieceMaxRow
  const rowMax = boardMaxRow - pieceMinRow
  const colMin = boardMinCol - pieceMaxCol
  const colMax = boardMaxCol - pieceMinCol

  for (let dr = rowMin; dr <= rowMax; dr++) {
    for (let dc = colMin; dc <= colMax; dc++) {
      const placed = getPlacedCells(orientedCells, { row: dr, col: dc })

      // 全セルがボード内 & 非占有か
      let valid = true
      for (const c of placed) {
        const key = cellKey(c)
        if (!boardSet.has(key) || occupiedSet.has(key)) {
          valid = false
          break
        }
      }
      if (!valid) continue

      // この配置の重心とドロップ位置の距離
      const positions = placed.map(c => gridToWorld(c, cellSize, gridType))
      const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length
      const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length
      const dx = cx - dropPosition.x
      const dy = cy - dropPosition.y
      const distSq = dx * dx + dy * dy

      if (distSq < bestDistSq) {
        bestDistSq = distSq
        bestOffset = { row: dr, col: dc }
      }
    }
  }

  return bestOffset
}
