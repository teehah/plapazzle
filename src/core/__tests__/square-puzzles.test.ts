import { describe, it, expect } from 'vitest'
import { PUZZLES } from '../../data/puzzles'
import { buildAndSolve } from '../solver'
import { GRID_OPS } from '../grid-ops'

describe('ペントミノ 6x10', () => {
  const puzzle = PUZZLES.find(p => p.id === 'pentomino-6x10')

  it('パズルレジストリに登録されている', () => {
    expect(puzzle).toBeDefined()
  })

  it('ボードは60セル', () => {
    expect(puzzle!.board).toHaveLength(60)
  })

  it('ピースは12個', () => {
    expect(puzzle!.pieces).toHaveLength(12)
  })

  it('gridTypeはsquare', () => {
    expect(puzzle!.gridType).toBe('square')
  })

  it('解が見つかる', () => {
    const ops = GRID_OPS[puzzle!.gridType]
    let count = 0
    buildAndSolve(puzzle!.board, puzzle!.pieces, () => { count++ }, ops.uniqueOrientations)
    expect(count).toBeGreaterThan(0)
  }, 60000)
})

describe('テトロミノ 5x8', () => {
  const puzzle = PUZZLES.find(p => p.id === 'tetromino-5x8')

  it('パズルレジストリに登録されている', () => {
    expect(puzzle).toBeDefined()
  })

  it('ボードは40セル', () => {
    expect(puzzle!.board).toHaveLength(40)
  })

  it('ピースは10個', () => {
    expect(puzzle!.pieces).toHaveLength(10)
  })

  it('解が見つかる', () => {
    const ops = GRID_OPS[puzzle!.gridType]
    let count = 0
    buildAndSolve(puzzle!.board, puzzle!.pieces, () => { count++ }, ops.uniqueOrientations)
    expect(count).toBeGreaterThan(0)
  }, 60000)
})
