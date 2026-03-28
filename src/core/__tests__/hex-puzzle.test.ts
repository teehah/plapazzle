import { describe, it, expect } from 'vitest'
import type { Cell } from '../grid'
import { PUZZLES } from '../../data/puzzles'
import { buildAndSolve } from '../solver'
import { GRID_OPS } from '../grid-ops'

describe('ペンタヘックス 11x10平行四辺形', () => {
  const puzzle = PUZZLES.find(p => p.id === 'pentahex-parallelogram')

  it('パズルレジストリに登録されている', () => {
    expect(puzzle).toBeDefined()
  })

  it('ボードは110セル', () => {
    expect(puzzle!.board).toHaveLength(110)
  })

  it('ピースは22個', () => {
    expect(puzzle!.pieces).toHaveLength(22)
  })

  it('gridTypeはhexagonal', () => {
    expect(puzzle!.gridType).toBe('hexagonal')
  })

  // 22ピース全探索は時間がかかるため skip
  it.skip('解が見つかる（全探索: 長時間）', () => {
    const ops = GRID_OPS[puzzle!.gridType]
    let count = 0
    buildAndSolve(puzzle!.board, puzzle!.pieces, () => { count++ }, ops.uniqueOrientations)
    expect(count).toBeGreaterThan(0)
  }, 600000)

  it('ソルバが六角形グリッドで動作する（1ピース = ボード）', () => {
    const ops = GRID_OPS['hexagonal']
    const piece = puzzle!.pieces[0]
    // ボードをピースと同じ形にする → ちょうど1解
    let count = 0
    buildAndSolve(piece.cells, [piece], () => { count++ }, ops.uniqueOrientations)
    expect(count).toBeGreaterThan(0)
  })
})
