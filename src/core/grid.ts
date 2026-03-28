export type Cell = { row: number; col: number; dir: 0 | 1 }

export function cellKey(c: Cell): string {
  return `${c.row},${c.col},${c.dir}`
}

/**
 * Returns the 3 logical neighbors of a cell (unconditionally).
 * Neighbors may have negative row/col if c is at the board edge.
 * Callers are responsible for filtering out cells outside the board boundary.
 */
export function neighbors(c: Cell): Cell[] {
  if (c.dir === 0) {
    // △: 左▽, 右▽(同col), 上▽
    return [
      { row: c.row,     col: c.col - 1, dir: 1 },
      { row: c.row,     col: c.col,     dir: 1 },
      { row: c.row - 1, col: c.col,     dir: 1 },
    ]
  } else {
    // ▽: 左△(同col), 右△, 下△
    return [
      { row: c.row,     col: c.col,     dir: 0 },
      { row: c.row,     col: c.col + 1, dir: 0 },
      { row: c.row + 1, col: c.col,     dir: 0 },
    ]
  }
}

export function cellToSvgPoints(c: Cell, H: number): [[number, number], [number, number], [number, number]] {
  const W = H * 2 / Math.sqrt(3)
  const { row, col, dir } = c
  // 斜交座標系: row軸=水平、col軸=60°斜め
  // 格子点(n1,n2)の位置 = (n1*W + n2*W/2, n2*H)
  // k = 2*row + col でx方向の基準位置を計算
  const k = 2 * row + col
  if (dir === 0) {
    return [
      [k * W / 2,       col * H],
      [(k + 2) * W / 2, col * H],
      [(k + 1) * W / 2, (col + 1) * H],
    ]
  } else {
    return [
      [(k + 2) * W / 2, col * H],
      [(k + 1) * W / 2, (col + 1) * H],
      [(k + 3) * W / 2, (col + 1) * H],
    ]
  }
}
