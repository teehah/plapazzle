import type { PuzzleDef } from '../core/puzzle'
import { NO6_BOARD } from './no6'
import { PIECES } from '../core/piece'

export const PUZZLES: PuzzleDef[] = [
  {
    id: 'no6',
    name: 'ヘキサモンド 72セル',
    board: NO6_BOARD.cells,
    pieces: PIECES,
    gridType: 'triangular',
  },
]
