import { describe, it, expect } from 'vitest'
import { PUZZLES } from '../../data/puzzles'
import { buildAndSolve } from '../solver'

describe('PuzzleDef', () => {
  it('パズルレジストリに1つ以上のパズルが登録されている', () => {
    expect(PUZZLES.length).toBeGreaterThan(0)
  })

  it('各パズルはid, name, board, piecesを持つ', () => {
    for (const puzzle of PUZZLES) {
      expect(puzzle).toHaveProperty('id')
      expect(puzzle).toHaveProperty('name')
      expect(puzzle).toHaveProperty('board')
      expect(puzzle).toHaveProperty('pieces')
      expect(puzzle.board.length).toBeGreaterThan(0)
      expect(puzzle.pieces.length).toBeGreaterThan(0)
    }
  })

  it('各パズルのボードセル数 = ピース数 × ピースあたりセル数', () => {
    for (const puzzle of PUZZLES) {
      const cellsPerPiece = puzzle.pieces[0].cells.length
      expect(puzzle.board.length).toBe(puzzle.pieces.length * cellsPerPiece)
    }
  })

  it('No.6パズルがレジストリに含まれる', () => {
    const no6 = PUZZLES.find(p => p.id === 'no6')
    expect(no6).toBeDefined()
    expect(no6!.board).toHaveLength(72)
    expect(no6!.pieces).toHaveLength(12)
  })

  it('レジストリのパズルでソルバが動く', () => {
    const puzzle = PUZZLES[0]
    let count = 0
    buildAndSolve(puzzle.board, puzzle.pieces, () => { count++ })
    expect(count).toBeGreaterThan(0)
  }, 60000)
})
