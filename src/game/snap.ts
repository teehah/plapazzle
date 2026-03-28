import type { Cell } from '../core/grid'
import { cellKey } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { GRID_OPS } from '../core/grid-ops'
import type { Position, GridPosition } from './state'
import { getPlacedCells } from './placement'
import { svgBboxCenter } from './coords'

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
 * ルール:
 * 1. ドロップ位置がボード内にある場合のみスナップを試みる
 * 2. 最も近い有効配置を選ぶ
 * 3. スナップ先とドロップ位置が離れすぎていたらスナップしない
 *    （ピースの中心がボード外にあるのにボード端に吸い付くのを防ぐ）
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

  // ドロップ位置がボード内にあるか判定（マージンなし）
  const bbox = boardBoundingBox(boardCells, cellSize, gridType)
  if (
    dropPosition.x < bbox.minX ||
    dropPosition.x > bbox.maxX ||
    dropPosition.y < bbox.minY ||
    dropPosition.y > bbox.maxY
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

      // この配置の bbox 中心とドロップ位置の距離
      const center = svgBboxCenter(placed, cellSize, gridType)
      const dx = center.x - dropPosition.x
      const dy = center.y - dropPosition.y
      const distSq = dx * dx + dy * dy

      if (distSq < bestDistSq) {
        bestDistSq = distSq
        bestOffset = { row: dr, col: dc }
      }
    }
  }

  // スナップ先が遠すぎる場合はスナップしない
  // （ピース中心がボード端にあり、最寄り有効配置がボード内部にしかない場合を防ぐ）
  const maxSnapDist = cellSize * 1.5
  if (bestDistSq > maxSnapDist * maxSnapDist) {
    return null
  }

  return bestOffset
}
