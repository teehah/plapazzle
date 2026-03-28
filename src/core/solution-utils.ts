import type { Cell } from './grid'
import { cellKey } from './grid'
import type { Solution } from './solver'

/** Solution マップをソート済み文字列に変換（重複排除用） */
export function normalizeSolution(sol: Solution): string {
  return [...sol.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}:${v}`)
    .join('|')
}

/**
 * ボード対称変換を適用した解を生成する。
 * transform は Cell → Cell のマッピング。
 */
function transformSolution(sol: Solution, board: Cell[], transform: (c: Cell) => Cell): Solution {
  const result: Solution = new Map()
  for (const cell of board) {
    const key = cellKey(cell)
    const pieceId = sol.get(key)
    if (pieceId !== undefined) {
      const transformed = transform(cell)
      result.set(cellKey(transformed), pieceId)
    }
  }
  return result
}

/**
 * 解の canonical form を返す。
 * boardTransforms にはボードの対称変換群（identity を含む）を渡す。
 * 全変換を適用し、辞書順最小のものを canonical とする。
 */
export function canonicalSolution(
  sol: Solution,
  board: Cell[],
  boardTransforms: Array<(c: Cell) => Cell>,
): string {
  let best = normalizeSolution(sol)
  for (const transform of boardTransforms) {
    const transformed = transformSolution(sol, board, transform)
    const key = normalizeSolution(transformed)
    if (key < best) best = key
  }
  return best
}

/**
 * 同一配置の解を除去（同一ピース入れ替え + ボード対称性の両方を考慮）。
 * boardTransforms が undefined の場合はピース入れ替えのみ除去。
 */
export function deduplicateSolutions(
  solutions: Solution[],
  board?: Cell[],
  boardTransforms?: Array<(c: Cell) => Cell>,
): Solution[] {
  const seen = new Set<string>()
  const result: Solution[] = []
  for (const sol of solutions) {
    const key = (board && boardTransforms)
      ? canonicalSolution(sol, board, boardTransforms)
      : normalizeSolution(sol)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(sol)
    }
  }
  return result
}

// --- ボード対称変換の定義 ---

/** 長方形ボード (R×C) の対称群: identity, 180°回転, H-flip, V-flip */
export function rectSymmetries(rows: number, cols: number): Array<(c: Cell) => Cell> {
  return [
    (c) => c,  // identity
    (c) => ({ row: rows - 1 - c.row, col: cols - 1 - c.col, dir: c.dir }),  // 180°
    (c) => ({ row: c.row, col: cols - 1 - c.col, dir: c.dir }),              // H-flip
    (c) => ({ row: rows - 1 - c.row, col: c.col, dir: c.dir }),              // V-flip
  ]
}

/** 正方形ボード (N×N) の対称群: D4 (8元) */
export function squareSymmetries(n: number): Array<(c: Cell) => Cell> {
  return [
    (c) => c,                                                                    // identity
    (c) => ({ row: c.col, col: n - 1 - c.row, dir: c.dir }),                   // 90° CW
    (c) => ({ row: n - 1 - c.row, col: n - 1 - c.col, dir: c.dir }),           // 180°
    (c) => ({ row: n - 1 - c.col, col: c.row, dir: c.dir }),                   // 270° CW
    (c) => ({ row: c.row, col: n - 1 - c.col, dir: c.dir }),                   // H-flip
    (c) => ({ row: n - 1 - c.row, col: c.col, dir: c.dir }),                   // V-flip
    (c) => ({ row: c.col, col: c.row, dir: c.dir }),                            // diag
    (c) => ({ row: n - 1 - c.col, col: n - 1 - c.row, dir: c.dir }),           // anti-diag
  ]
}

/** ヘキサモンド72セルボードの対称群: 180°回転 (2元) */
export function hexiamond72Symmetries(): Array<(c: Cell) => Cell> {
  // 180°回転: rotate60 を3回適用 → (r,c,d) → (-r-1,-c-1,1-d)
  // ボード座標正規化: row範囲0-6, col範囲0-7 → offset (7, 8)
  return [
    (c) => c,  // identity
    (c) => ({
      row: 6 - c.row,
      col: 7 - c.col,
      dir: (1 - c.dir) as 0 | 1,
    }),  // 180°
  ]
}
