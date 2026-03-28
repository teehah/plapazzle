import { describe, it, expect } from 'vitest'
import { normalizeSolution, deduplicateSolutions } from '../solution-utils'
import type { Solution } from '../solver'

describe('normalizeSolution', () => {
  it('同一ピースIDの入れ替えは同じ正規形になる', () => {
    // 2つのI-pieceが入れ替わった解は同じ正規形
    const sol1: Solution = new Map([
      ['0,0,0', 'I'], ['0,1,0', 'I'], ['1,0,0', 'T'], ['1,1,0', 'T'],
    ])
    const sol2: Solution = new Map([
      ['0,0,0', 'I'], ['0,1,0', 'I'], ['1,0,0', 'T'], ['1,1,0', 'T'],
    ])
    expect(normalizeSolution(sol1)).toBe(normalizeSolution(sol2))
  })

  it('異なる配置は異なる正規形', () => {
    const sol1: Solution = new Map([
      ['0,0,0', 'I'], ['0,1,0', 'T'],
    ])
    const sol2: Solution = new Map([
      ['0,0,0', 'T'], ['0,1,0', 'I'],
    ])
    expect(normalizeSolution(sol1)).not.toBe(normalizeSolution(sol2))
  })
})

describe('deduplicateSolutions', () => {
  it('同一マップの解を除去する', () => {
    const sol: Solution = new Map([['0,0,0', 'A'], ['0,1,0', 'B']])
    const dup: Solution = new Map([['0,0,0', 'A'], ['0,1,0', 'B']])
    const diff: Solution = new Map([['0,0,0', 'B'], ['0,1,0', 'A']])
    const result = deduplicateSolutions([sol, dup, diff])
    expect(result).toHaveLength(2)
  })
})
