import { describe, it, expect } from 'vitest'
import { buildAndSolve } from '../solver'
import { NO6_BOARD } from '../../data/no6'
import { PIECES } from '../piece'

describe('buildAndSolve (No.6)', () => {
  it('ボードのセル数は72', () => {
    expect(NO6_BOARD.cells).toHaveLength(72)
  })

  it('ボードのセルに重複がない', () => {
    const keys = NO6_BOARD.cells.map(c => `${c.row},${c.col},${c.dir}`)
    expect(new Set(keys).size).toBe(72)
  })

  it('解が少なくとも1つ見つかる', () => {
    let count = 0
    buildAndSolve(NO6_BOARD.cells, PIECES, () => { count++ })
    expect(count).toBeGreaterThan(0)
  }, 60000) // 60秒タイムアウト

  it('全解数は9936（= 4968 × 2、ボードの2回転対称による）', () => {
    let count = 0
    buildAndSolve(NO6_BOARD.cells, PIECES, () => { count++ })
    expect(count).toBe(9936)
  }, 300000) // 5分タイムアウト
})
