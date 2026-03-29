/**
 * ヒント機能: 現在の配置に compatible な解法を見つけ、次の一手を提案する。
 */

import type { Cell } from '../core/grid'
import { cellKey } from '../core/grid'
import type { PieceDef } from '../core/piece'
import type { PuzzleDef } from '../core/puzzle'
import type { GridType } from '../core/grid-ops'
import { GRID_OPS } from '../core/grid-ops'
import type { PieceState, GridPosition } from './state'
import { getOrientedCells, getPlacedCells } from './placement'
import type { SolutionData } from './solution-loader'

/**
 * placement key ("r0,c0,d0;r1,c1,d1;...") をパースして Cell[] を返す。
 */
export function parsePlacementKey(key: string): Cell[] {
  if (!key) return []
  return key.split(';').map(part => {
    const [r, c, d] = part.split(',').map(Number)
    return { row: r, col: c, dir: d as 0 | 1 }
  })
}

/**
 * ユーザの配置済みピースを pieceId -> セルキー集合 に変換する。
 */
function collectPlacedPieceCells(
  pieces: PieceState[],
  puzzle: PuzzleDef,
  gridType: GridType,
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()

  for (const ps of pieces) {
    if (!ps.onBoard || !ps.gridPosition) continue
    const pieceDef = puzzle.pieces[ps.pieceIndex]
    const oriented = getOrientedCells(pieceDef, ps.orientationIndex, ps.flipped, gridType)
    const placed = getPlacedCells(oriented, ps.gridPosition)

    let cellSet = result.get(ps.pieceId)
    if (!cellSet) {
      cellSet = new Set<string>()
      result.set(ps.pieceId, cellSet)
    }
    for (const c of placed) {
      cellSet.add(cellKey(c))
    }
  }

  return result
}

/**
 * 現在の配置と compatible な解法のインデックス配列を返す。
 *
 * compatible: ユーザが配置済みの全ピースについて、
 * 解法内のそのピースの placement key が一致する。
 */
export function findCompatibleSolutions(
  pieces: PieceState[],
  puzzle: PuzzleDef,
  gridType: GridType,
  data: SolutionData,
): number[] {
  const placedCells = collectPlacedPieceCells(pieces, puzzle, gridType)

  // 配置済みピースがなければ全解法が compatible
  if (placedCells.size === 0) {
    return data.placements.map((_, i) => i)
  }

  // ユーザの配置を pieceOrder のインデックス -> sorted cellKeys の文字列に変換
  const userKeysByOrderIndex = new Map<number, string>()
  for (const [pieceId, cellSet] of placedCells) {
    const orderIndex = data.pieceOrder.indexOf(pieceId)
    if (orderIndex < 0) continue
    const sorted = [...cellSet].sort().join(';')
    userKeysByOrderIndex.set(orderIndex, sorted)
  }

  // 全解法を走査
  const compatible: number[] = []
  for (let si = 0; si < data.placements.length; si++) {
    const solution = data.placements[si]
    let match = true
    for (const [orderIdx, userKey] of userKeysByOrderIndex) {
      if (solution[orderIdx] !== userKey) {
        match = false
        break
      }
    }
    if (match) compatible.push(si)
  }

  return compatible
}

/**
 * compatible な解法から、まだ配置されていないピースの情報を1つ返す。
 * 配置済みピースに隣接するセルを持つピースを優先する。
 *
 * 返り値:
 * - pieceId: 次に置くべきピースID
 * - pieceOrderIndex: pieceOrder 内のインデックス
 * - cells: そのピースの目標セル群
 * - solutionIndex: 使用した解法のインデックス
 */
export type HintResult = {
  pieceId: string
  pieceOrderIndex: number
  cells: Cell[]
  solutionIndex: number
}

export function getHint(
  compatibleSolutionIndices: number[],
  pieces: PieceState[],
  puzzle: PuzzleDef,
  gridType: GridType,
  data: SolutionData,
): HintResult | null {
  if (compatibleSolutionIndices.length === 0) return null

  // 配置済みの pieceId セット
  const placedPieceIds = new Set<string>()
  for (const ps of pieces) {
    if (ps.onBoard && ps.gridPosition) {
      placedPieceIds.add(ps.pieceId)
    }
  }

  // 配置済みセルの隣接セル集合を構築
  const occupiedCells = new Set<string>()
  const adjacentCells = new Set<string>()
  const ops = GRID_OPS[gridType]

  for (const ps of pieces) {
    if (!ps.onBoard || !ps.gridPosition) continue
    const pieceDef = puzzle.pieces[ps.pieceIndex]
    const oriented = getOrientedCells(pieceDef, ps.orientationIndex, ps.flipped, gridType)
    const placed = getPlacedCells(oriented, ps.gridPosition)
    for (const c of placed) {
      occupiedCells.add(cellKey(c))
      for (const n of ops.neighbors(c)) {
        adjacentCells.add(cellKey(n))
      }
    }
  }

  // 最初の compatible solution を使う
  const solutionIndex = compatibleSolutionIndices[0]
  const solution = data.placements[solutionIndex]

  // 未配置ピースを候補として収集
  type Candidate = { pieceOrderIndex: number; pieceId: string; cells: Cell[]; adjacentScore: number }
  const candidates: Candidate[] = []

  for (let pi = 0; pi < data.pieceOrder.length; pi++) {
    const pieceId = data.pieceOrder[pi]
    if (placedPieceIds.has(pieceId)) continue

    const cells = parsePlacementKey(solution[pi])
    if (cells.length === 0) continue

    // 隣接スコア: ピースのセルのうち adjacentCells に含まれるものの数
    let adjacentScore = 0
    if (adjacentCells.size > 0) {
      for (const c of cells) {
        if (adjacentCells.has(cellKey(c))) {
          adjacentScore++
        }
      }
    }

    candidates.push({ pieceOrderIndex: pi, pieceId, cells, adjacentScore })
  }

  if (candidates.length === 0) return null

  // 配置済みピースがある場合は隣接スコアで並べ替え、なければ pieceOrder 順のまま
  if (placedPieceIds.size > 0) {
    candidates.sort((a, b) => b.adjacentScore - a.adjacentScore)
  }

  const best = candidates[0]
  return {
    pieceId: best.pieceId,
    pieceOrderIndex: best.pieceOrderIndex,
    cells: best.cells,
    solutionIndex,
  }
}

/**
 * ヒントで指定されたセル群に一致するピースの orientation/flip/gridPosition を見つける。
 *
 * 返り値:
 * - orientationIndex: 向きインデックス
 * - flipped: 反転状態
 * - gridPosition: 配置位置
 */
export type PlacementResult = {
  orientationIndex: number
  flipped: boolean
  gridPosition: GridPosition
}

export function findPlacement(
  pieceDef: PieceDef,
  targetCells: Cell[],
  boardCells: Cell[],
  gridType: GridType,
): PlacementResult | null {
  const targetSet = new Set(targetCells.map(cellKey))
  const ops = GRID_OPS[gridType]

  // ボード座標範囲
  const boardMinRow = Math.min(...boardCells.map(c => c.row))
  const boardMaxRow = Math.max(...boardCells.map(c => c.row))
  const boardMinCol = Math.min(...boardCells.map(c => c.col))
  const boardMaxCol = Math.max(...boardCells.map(c => c.col))

  // 全 orientation (非反転) を取得
  const orientations = ops.uniqueOrientations(pieceDef.cells)

  for (let flip = 0; flip < 2; flip++) {
    for (let oi = 0; oi < orientations.length; oi++) {
      let cells = orientations[oi]
      if (flip === 1) {
        cells = cells.map(c => ops.mirror(c))
        const minRow = Math.min(...cells.map(c => c.row))
        const minCol = Math.min(...cells.map(c => c.col))
        cells = cells.map(c => ({ row: c.row - minRow, col: c.col - minCol, dir: c.dir }))
      }

      const pieceMinRow = Math.min(...cells.map(c => c.row))
      const pieceMaxRow = Math.max(...cells.map(c => c.row))
      const pieceMinCol = Math.min(...cells.map(c => c.col))
      const pieceMaxCol = Math.max(...cells.map(c => c.col))

      const rowMin = boardMinRow - pieceMaxRow
      const rowMax = boardMaxRow - pieceMinRow
      const colMin = boardMinCol - pieceMaxCol
      const colMax = boardMaxCol - pieceMinCol

      for (let dr = rowMin; dr <= rowMax; dr++) {
        for (let dc = colMin; dc <= colMax; dc++) {
          const placed = getPlacedCells(cells, { row: dr, col: dc })

          if (placed.length !== targetCells.length) continue

          // 全セルが targetSet に含まれるか
          let match = true
          for (const c of placed) {
            if (!targetSet.has(cellKey(c))) {
              match = false
              break
            }
          }
          if (match) {
            return {
              orientationIndex: oi,
              flipped: flip === 1,
              gridPosition: { row: dr, col: dc },
            }
          }
        }
      }
    }
  }

  return null
}
