import { describe, it, expect } from 'vitest'
import { checkCleared } from '../clear-check'
import type { Cell } from '../../core/grid'

const board: Cell[] = [
  { row: 0, col: 0, dir: 0 },
  { row: 0, col: 1, dir: 0 },
]

describe('checkCleared', () => {
  it('全セルが埋まっていればtrue', () => {
    const covered: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
    ]
    expect(checkCleared(board, covered)).toBe(true)
  })

  it('セルが足りなければfalse', () => {
    expect(checkCleared(board, [{ row: 0, col: 0, dir: 0 }])).toBe(false)
  })

  it('空ならfalse', () => {
    expect(checkCleared(board, [])).toBe(false)
  })

  it('ボード外セルがあっても全ボードセルが埋まっていればtrue', () => {
    const covered: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
      { row: 9, col: 9, dir: 0 },
    ]
    expect(checkCleared(board, covered)).toBe(true)
  })
})
