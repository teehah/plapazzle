export type Cell = { row: number; col: number; dir: 0 | 1 }

export function cellKey(c: Cell): string {
  return `${c.row},${c.col},${c.dir}`
}

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
  if (dir === 0) {
    return [
      [col * W / 2,       (row + 1) * H],
      [(col + 1) * W / 2, row * H],
      [(col + 2) * W / 2, (row + 1) * H],
    ]
  } else {
    return [
      [col * W / 2,       row * H],
      [(col + 2) * W / 2, row * H],
      [(col + 1) * W / 2, (row + 1) * H],
    ]
  }
}
