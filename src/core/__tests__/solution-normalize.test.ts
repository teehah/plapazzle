import { describe, it, expect } from 'vitest'
import { normalizeSolution, deduplicateSolutions, rectSymmetries } from '../solution-utils'
import type { Solution } from '../solver'
import type { Cell } from '../grid'

describe('normalizeSolution', () => {
  it('同一ピースIDの入れ替えは同じ正規形になる', () => {
    const sol1: Solution = new Map([
      ['0,0,0', 'I'], ['0,1,0', 'I'], ['1,0,0', 'T'], ['1,1,0', 'T'],
    ])
    const sol2: Solution = new Map([
      ['0,0,0', 'I'], ['0,1,0', 'I'], ['1,0,0', 'T'], ['1,1,0', 'T'],
    ])
    expect(normalizeSolution(sol1)).toBe(normalizeSolution(sol2))
  })

  it('異なる配置は異なる正規形', () => {
    const sol1: Solution = new Map([['0,0,0', 'I'], ['0,1,0', 'T']])
    const sol2: Solution = new Map([['0,0,0', 'T'], ['0,1,0', 'I']])
    expect(normalizeSolution(sol1)).not.toBe(normalizeSolution(sol2))
  })
})

describe('deduplicateSolutions with board symmetry', () => {
  // 2×2 ボードで対称性テスト
  const board: Cell[] = [
    { row: 0, col: 0, dir: 0 }, { row: 0, col: 1, dir: 0 },
    { row: 1, col: 0, dir: 0 }, { row: 1, col: 1, dir: 0 },
  ]
  const transforms = rectSymmetries(2, 2)

  it('180°回転像は同一解として除去される', () => {
    const sol1: Solution = new Map([
      ['0,0,0', 'A'], ['0,1,0', 'A'], ['1,0,0', 'B'], ['1,1,0', 'B'],
    ])
    // 180°回転像: A と B の位置が入れ替わる
    const sol2: Solution = new Map([
      ['0,0,0', 'B'], ['0,1,0', 'B'], ['1,0,0', 'A'], ['1,1,0', 'A'],
    ])
    const result = deduplicateSolutions([sol1, sol2], board, transforms)
    expect(result).toHaveLength(1)
  })

  it('対称でない解は除去されない', () => {
    const sol1: Solution = new Map([
      ['0,0,0', 'A'], ['0,1,0', 'B'], ['1,0,0', 'C'], ['1,1,0', 'D'],
    ])
    const sol2: Solution = new Map([
      ['0,0,0', 'A'], ['0,1,0', 'C'], ['1,0,0', 'B'], ['1,1,0', 'D'],
    ])
    const result = deduplicateSolutions([sol1, sol2], board, transforms)
    expect(result).toHaveLength(2)
  })
})
