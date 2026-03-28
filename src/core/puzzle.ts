import type { Cell } from './grid'
import type { PieceDef } from './piece'
import type { GridType } from './grid-ops'

export type PuzzleDef = {
  id: string
  name: string
  board: Cell[]
  pieces: PieceDef[]
  gridType: GridType
  boardSymmetries?: Array<(c: Cell) => Cell>
}
