import type { PieceDef } from '../core/piece'
import type { Cell } from '../core/grid'

function c(row: number, col: number): Cell {
  return { row, col, dir: 0 }
}

/**
 * ペントミノ12種（5格正方形ポリオミノ、free）
 * 命名: Conway / Golomb 標準
 */
export const PENTOMINOES: PieceDef[] = [
  {
    id: 'F',
    cells: [c(0,1), c(0,2), c(1,0), c(1,1), c(2,1)],
  },
  {
    id: 'I',
    cells: [c(0,0), c(0,1), c(0,2), c(0,3), c(0,4)],
  },
  {
    id: 'L',
    cells: [c(0,0), c(1,0), c(2,0), c(3,0), c(3,1)],
  },
  {
    id: 'N',
    cells: [c(0,0), c(1,0), c(2,0), c(2,1), c(3,1)],
  },
  {
    id: 'P',
    cells: [c(0,0), c(0,1), c(1,0), c(1,1), c(2,0)],
  },
  {
    id: 'T',
    cells: [c(0,0), c(0,1), c(0,2), c(1,1), c(2,1)],
  },
  {
    id: 'U',
    cells: [c(0,0), c(0,2), c(1,0), c(1,1), c(1,2)],
  },
  {
    id: 'V',
    cells: [c(0,0), c(1,0), c(2,0), c(2,1), c(2,2)],
  },
  {
    id: 'W',
    cells: [c(0,0), c(1,0), c(1,1), c(2,1), c(2,2)],
  },
  {
    id: 'X',
    cells: [c(0,1), c(1,0), c(1,1), c(1,2), c(2,1)],
  },
  {
    id: 'Y',
    cells: [c(0,0), c(1,0), c(1,1), c(2,0), c(3,0)],
  },
  {
    id: 'Z',
    cells: [c(0,0), c(0,1), c(1,1), c(2,1), c(2,2)],
  },
]

/**
 * テトロミノ5種（4格正方形ポリオミノ、free）
 * S は Z の鏡像を含む、L は J の鏡像を含む
 */
export const TETROMINOES: PieceDef[] = [
  {
    id: 'I',
    cells: [c(0,0), c(0,1), c(0,2), c(0,3)],
  },
  {
    id: 'O',
    cells: [c(0,0), c(0,1), c(1,0), c(1,1)],
  },
  {
    id: 'T',
    cells: [c(0,0), c(0,1), c(0,2), c(1,1)],
  },
  {
    id: 'S',
    cells: [c(0,1), c(0,2), c(1,0), c(1,1)],
  },
  {
    id: 'L',
    cells: [c(0,0), c(1,0), c(2,0), c(2,1)],
  },
]
