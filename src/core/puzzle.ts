import type { Cell } from './grid'
import type { PieceDef } from './piece'

export type PuzzleDef = {
  id: string
  name: string
  board: Cell[]
  pieces: PieceDef[]
}
