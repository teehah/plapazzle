import type { PuzzleDef } from '../core/puzzle'
import type { Cell } from '../core/grid'
import { NO6_BOARD } from './no6'
import { PIECES } from '../core/piece'
import { PENTOMINOES, TETROMINOES } from './square-pieces'

function rectBoard(rows: number, cols: number): Cell[] {
  const cells: Cell[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ row: r, col: c, dir: 0 })
    }
  }
  return cells
}

export const PUZZLES: PuzzleDef[] = [
  {
    id: 'no6',
    name: 'ヘキサモンド 72セル',
    board: NO6_BOARD.cells,
    pieces: PIECES,
    gridType: 'triangular',
  },
  {
    id: 'pentomino-6x10',
    name: 'ペントミノ 6×10',
    board: rectBoard(6, 10),
    pieces: PENTOMINOES,
    gridType: 'square',
  },
  {
    id: 'tetromino-5x8',
    name: 'テトロミノ 5×8',
    board: rectBoard(5, 8),
    pieces: [...TETROMINOES, ...TETROMINOES],  // 5種×2セット = 10ピース
    gridType: 'square',
  },
]
