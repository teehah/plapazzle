import type { Cell } from './grid'
import { cellKey } from './grid'
import type { PieceDef } from './piece'
import { uniqueOrientations as triOrientations } from './piece'
import { solveExactCover } from './dlx'
import type { GridType } from './grid-ops'
import { hasDeadIsland } from './island-pruning'

export type Solution = Map<string, string>  // cellKey -> pieceId

/** WebWorkerへの入力メッセージ型 */
export type WorkerInput = {
  board: Cell[]
  pieces: PieceDef[]
  gridType: GridType
}

/** WebWorkerからの出力メッセージ型 */
export type WorkerResult = {
  solutions: Array<[string, string][]>  // Solution(Map)をシリアライズしたもの
}

/**
 * ボードセルとピース一覧を受け取り、Exact Cover で全解を列挙する。
 * 解が見つかるたびに onSolution コールバックを呼ぶ。
 */
export function buildAndSolve(
  boardCells: Cell[],
  pieces: PieceDef[],
  onSolution: (sol: Solution) => void,
  orientationsFn?: (cells: Cell[]) => Cell[][],
  neighborsFn?: (c: Cell) => Cell[],
): void {
  // セルインデックスマップ
  const cellIndex = new Map<string, number>()
  boardCells.forEach((c, i) => cellIndex.set(cellKey(c), i))

  // Exact Cover の列: [piece_0, ..., piece_K-1, cell_0, ..., cell_N-1]
  const numPieceCols = pieces.length
  const numCellCols = boardCells.length
  const numCols = numPieceCols + numCellCols

  // 配置の列挙
  type Placement = { cols: number[]; pieceId: string; cells: Cell[] }
  const placements: Placement[] = []

  // ボードの範囲を事前計算（探索範囲の制限）
  const allRows = boardCells.map(c => c.row)
  const allCols = boardCells.map(c => c.col)
  const minBoardRow = Math.min(...allRows)
  const maxBoardRow = Math.max(...allRows)
  const minBoardCol = Math.min(...allCols)
  const maxBoardCol = Math.max(...allCols)

  for (let pi = 0; pi < pieces.length; pi++) {
    const piece = pieces[pi]
    const orientations = (orientationsFn ?? triOrientations)(piece.cells)

    for (const orientation of orientations) {
      // この向きの各セルについてオフセットを試す
      const oMinRow = Math.min(...orientation.map(c => c.row))
      const oMaxRow = Math.max(...orientation.map(c => c.row))
      const oMinCol = Math.min(...orientation.map(c => c.col))
      const oMaxCol = Math.max(...orientation.map(c => c.col))

      // 平行移動の範囲を制限
      const drMin = minBoardRow - oMinRow
      const drMax = maxBoardRow - oMaxRow
      const dcMin = minBoardCol - oMinCol
      const dcMax = maxBoardCol - oMaxCol

      for (let dr = drMin; dr <= drMax; dr++) {
        for (let dc = dcMin; dc <= dcMax; dc++) {
          const translated: Cell[] = orientation.map(c => ({
            row: c.row + dr,
            col: c.col + dc,
            dir: c.dir,
          }))

          const cols: number[] = [pi]
          let valid = true
          for (const tc of translated) {
            const idx = cellIndex.get(cellKey(tc))
            if (idx === undefined) { valid = false; break }
            cols.push(numPieceCols + idx)
          }
          if (!valid) continue

          // 重複列チェック（同じセルに2回置いていないか）
          if (new Set(cols).size !== cols.length) continue

          placements.push({ cols, pieceId: piece.id, cells: translated })
        }
      }
    }
  }

  // Island pruning: 空きセルの連結成分が残りピースで埋められなければ枝刈り
  const allSameSize = pieces.every(p => p.cells.length === pieces[0].cells.length)
  const pruner = (neighborsFn && allSameSize)
    ? (() => {
        const cellsPerPiece = pieces[0].cells.length
        return (getUncoveredCols: () => number[]) => {
          const uncoveredCellCols = getUncoveredCols().filter(c => c >= numPieceCols)
          const emptyCells = uncoveredCellCols.map(c => boardCells[c - numPieceCols])
          return hasDeadIsland(emptyCells, neighborsFn, cellsPerPiece)
        }
      })()
    : undefined

  solveExactCover(numCols, placements.map(p => p.cols), (selectedRows) => {
    const sol: Solution = new Map()
    for (const ri of selectedRows) {
      const p = placements[ri]
      for (const cell of p.cells) {
        sol.set(cellKey(cell), p.pieceId)
      }
    }
    onSolution(sol)
  }, pruner)
}
