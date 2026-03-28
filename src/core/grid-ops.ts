import type { Cell } from './grid'
import { neighbors as triNeighbors, cellToSvgPoints as triSvgPoints } from './grid'
import { uniqueOrientations as triUniqueOrientations } from './piece'

export interface GridOps {
  neighbors(c: Cell): Cell[]
  cellToSvgPoints(c: Cell, size: number): [number, number][]
  uniqueOrientations(cells: Cell[]): Cell[][]
}

export type GridType = 'triangular' | 'square' | 'hexagonal'

// --- 三角グリッド（既存コードのラッパー） ---

const triangularOps: GridOps = {
  neighbors: triNeighbors,
  cellToSvgPoints: (c, size) => [...triSvgPoints(c, size)],
  uniqueOrientations: triUniqueOrientations,
}

// --- 正方形グリッド ---

function sqNormalize(cells: Cell[]): Cell[] {
  const minRow = Math.min(...cells.map(c => c.row))
  const minCol = Math.min(...cells.map(c => c.col))
  return cells
    .map(c => ({ row: c.row - minRow, col: c.col - minCol, dir: 0 as const }))
    .sort((a, b) => a.row - b.row || a.col - b.col)
}

function sqCellsKey(cells: Cell[]): string {
  return sqNormalize(cells).map(c => `${c.row},${c.col}`).join('|')
}

function sqRotate90(c: Cell): Cell {
  return { row: c.col, col: -c.row, dir: 0 }
}

function sqMirror(c: Cell): Cell {
  return { row: c.row, col: -c.col, dir: 0 }
}

const squareOps: GridOps = {
  neighbors(c: Cell): Cell[] {
    return [
      { row: c.row - 1, col: c.col, dir: 0 },
      { row: c.row + 1, col: c.col, dir: 0 },
      { row: c.row, col: c.col - 1, dir: 0 },
      { row: c.row, col: c.col + 1, dir: 0 },
    ]
  },

  cellToSvgPoints(c: Cell, size: number): [number, number][] {
    const x = c.col * size
    const y = c.row * size
    return [
      [x, y],
      [x + size, y],
      [x + size, y + size],
      [x, y + size],
    ]
  },

  uniqueOrientations(cells: Cell[]): Cell[][] {
    const seen = new Set<string>()
    const result: Cell[][] = []
    let cur = [...cells]
    for (let flip = 0; flip < 2; flip++) {
      for (let rot = 0; rot < 4; rot++) {
        const key = sqCellsKey(cur)
        if (!seen.has(key)) {
          seen.add(key)
          result.push(sqNormalize(cur))
        }
        cur = cur.map(sqRotate90)
      }
      cur = cells.map(sqMirror)
    }
    return result
  },
}

// --- レジストリ ---

export const GRID_OPS: Record<GridType, GridOps> = {
  triangular: triangularOps,
  square: squareOps,
  hexagonal: squareOps, // placeholder
}
