import { describe, it, expect } from 'vitest'
import { solveExactCover } from '../dlx'

describe('solveExactCover', () => {
  it('単純な2解の問題', () => {
    // 列: A B C D (indices 0-3)
    // 行0: A B     → [0,1]
    // 行1:   B C   → [1,2]
    // 行2:     C D → [2,3]
    // 行3: A   C   → [0,2]
    // 行4:   B   D → [1,3]
    // 解1: 行0 + 行2 = {A,B} ∪ {C,D} = {A,B,C,D}
    // 解2: 行3 + 行4 = {A,C} ∪ {B,D} = {A,B,C,D}
    const solutions: number[][] = []
    solveExactCover(4, [[0,1],[1,2],[2,3],[0,2],[1,3]], s => solutions.push([...s]))
    expect(solutions).toHaveLength(2)
    expect(solutions).toContainEqual(expect.arrayContaining([0, 2]))
    expect(solutions).toContainEqual(expect.arrayContaining([3, 4]))
  })

  it('解なし', () => {
    // 列: A B C — 行0が{A,B}だけ → Cをカバーできない
    const solutions: number[][] = []
    solveExactCover(3, [[0,1]], s => solutions.push([...s]))
    expect(solutions).toHaveLength(0)
  })

  it('1解だけある問題', () => {
    // 列: A B C
    // 行0: A → [0]
    // 行1: B → [1]
    // 行2: C → [2]
    const solutions: number[][] = []
    solveExactCover(3, [[0],[1],[2]], s => solutions.push([...s]))
    expect(solutions).toHaveLength(1)
    expect(solutions[0]).toEqual(expect.arrayContaining([0,1,2]))
  })

  it('同じ列を2度カバーする行は解に含まれない', () => {
    // 列: A B
    // 行0: A B → [0,1]
    // 行1: A   → [0]
    // 行2:   B → [1]
    // 解: {行0} または {行1, 行2}
    const solutions: number[][] = []
    solveExactCover(2, [[0,1],[0],[1]], s => solutions.push([...s]))
    expect(solutions).toHaveLength(2)
  })
})
