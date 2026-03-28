import { describe, it, expect } from 'vitest'
import { PENTOMINOES, TETROMINOES } from '../../data/square-pieces'
import { GRID_OPS } from '../grid-ops'

const sq = GRID_OPS.square

describe('PENTOMINOES', () => {
  it('12種類ある', () => {
    expect(PENTOMINOES).toHaveLength(12)
  })
  it('各ピースは5セル', () => {
    for (const p of PENTOMINOES) {
      expect(p.cells).toHaveLength(5)
    }
  })
  it('全ピースのIDは一意', () => {
    const ids = PENTOMINOES.map(p => p.id)
    expect(new Set(ids).size).toBe(12)
  })
  it('各ピースのdirは全て0', () => {
    for (const p of PENTOMINOES) {
      for (const c of p.cells) {
        expect(c.dir).toBe(0)
      }
    }
  })
  // 既知の向き数
  // F=8, I=2, L=8, N=8, P=8, T=4, U=4, V=4, W=4, X=1, Y=8, Z=4
  const expectedOrientations: Record<string, number> = {
    F: 8, I: 2, L: 8, N: 8, P: 8, T: 4, U: 4, V: 4, W: 4, X: 1, Y: 8, Z: 4,
  }
  for (const [id, expected] of Object.entries(expectedOrientations)) {
    it(`${id}は${expected}向き`, () => {
      const piece = PENTOMINOES.find(p => p.id === id)
      expect(piece).toBeDefined()
      const orientations = sq.uniqueOrientations(piece!.cells)
      expect(orientations).toHaveLength(expected)
    })
  }
})

describe('TETROMINOES', () => {
  it('5種類ある', () => {
    expect(TETROMINOES).toHaveLength(5)
  })
  it('各ピースは4セル', () => {
    for (const p of TETROMINOES) {
      expect(p.cells).toHaveLength(4)
    }
  })
  // I=2, O=1, T=4, S=4, L=8 (free tetrominoes: S includes Z via mirror)
  // Wait - free tetrominoes are: I, O, T, S, L (5 types)
  // But S and Z are the same free tetromino (mirror of each other)
  // Same for L and J
  const expectedOrientations: Record<string, number> = {
    I: 2, O: 1, T: 4, S: 4, L: 8,
  }
  for (const [id, expected] of Object.entries(expectedOrientations)) {
    it(`${id}は${expected}向き`, () => {
      const piece = TETROMINOES.find(p => p.id === id)
      expect(piece).toBeDefined()
      const orientations = sq.uniqueOrientations(piece!.cells)
      expect(orientations).toHaveLength(expected)
    })
  }
})
