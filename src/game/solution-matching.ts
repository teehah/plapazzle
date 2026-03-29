/**
 * ユーザのピース配置を解法データと照合する。
 *
 * ユーザの配置を正規化された placement key に変換し、
 * 解法データの全解と比較して一致するものを返す。
 */

import type { Cell } from '../core/grid'
import { cellKey } from '../core/grid'
import type { PuzzleDef } from '../core/puzzle'
import type { GridType } from '../core/grid-ops'
import type { PieceState } from './state'
import { getOrientedCells, getPlacedCells } from './placement'
import type { SolutionData } from './solution-loader'

/**
 * ユーザの配置を正規化された placement key の Map に変換する。
 * key: pieceId, value: ソート済みセルキーを ";" で結合した文字列
 *
 * テトロミノのように同一 pieceId のピースが複数ある場合、
 * 同じ pieceId の全配置セルをマージしてからソート・結合する。
 */
export function userPlacementToKeys(
  pieces: PieceState[],
  puzzle: PuzzleDef,
  gridType: GridType,
): Map<string, string> {
  // pieceId -> cellKey[] を収集
  const pieceIdToCells = new Map<string, string[]>()

  for (const ps of pieces) {
    if (!ps.onBoard || !ps.gridPosition) continue

    const pieceDef = puzzle.pieces[ps.pieceIndex]
    const oriented = getOrientedCells(pieceDef, ps.orientationIndex, ps.flipped, gridType)
    const placed: Cell[] = getPlacedCells(oriented, ps.gridPosition)

    let cells = pieceIdToCells.get(ps.pieceId)
    if (!cells) {
      cells = []
      pieceIdToCells.set(ps.pieceId, cells)
    }
    for (const c of placed) {
      cells.push(cellKey(c))
    }
  }

  // 各 pieceId の配置セルをソートして結合 → placement key
  const result = new Map<string, string>()
  for (const [pieceId, cells] of pieceIdToCells) {
    result.set(pieceId, cells.sort().join(';'))
  }

  return result
}

/**
 * ユーザの配置と一致する解法IDを返す。
 * 一致しない場合は null を返す。
 */
export function matchSolution(
  userPlacement: Map<string, string>,
  data: SolutionData,
): number | null {
  const { pieceOrder, placements } = data

  // ユーザの配置からピース順序に従った配列を作成
  const userKeys: string[] = pieceOrder.map(pid => userPlacement.get(pid) ?? '')

  // 全解法と比較
  for (let si = 0; si < placements.length; si++) {
    const solution = placements[si]
    let match = true
    for (let pi = 0; pi < pieceOrder.length; pi++) {
      if (solution[pi] !== userKeys[pi]) {
        match = false
        break
      }
    }
    if (match) return si
  }

  return null
}
