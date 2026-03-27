import { describe, it, expect } from 'vitest'
import { PIECES, uniqueOrientations, normalize } from '../piece'
import type { Cell } from '../grid'

describe('normalize', () => {
  it('最小row/colが0になるよう平行移動する', () => {
    const cells: Cell[] = [
      { row: 2, col: 3, dir: 0 },
      { row: 2, col: 3, dir: 1 },
      { row: 2, col: 4, dir: 0 },
    ]
    const norm = normalize(cells)
    const rows = norm.map(c => c.row)
    const cols = norm.map(c => c.col)
    expect(Math.min(...rows)).toBe(0)
    expect(Math.min(...cols)).toBe(0)
  })
})

describe('PIECES', () => {
  it('12種類ある', () => {
    expect(PIECES).toHaveLength(12)
  })
  it('各ピースはちょうど6セル', () => {
    for (const p of PIECES) {
      expect(p.cells).toHaveLength(6)
    }
  })
  it('全ピースの総セル数は72', () => {
    const total = PIECES.reduce((s, p) => s + p.cells.length, 0)
    expect(total).toBe(72)
  })
})

describe('uniqueOrientations', () => {
  it('O（正六角形）は1向き（完全対称）', () => {
    const O = PIECES.find(p => p.id === 'O')!
    expect(uniqueOrientations(O.cells)).toHaveLength(1)
  })
  it('X（蝶）は3向き（3回回転対称）', () => {
    const X = PIECES.find(p => p.id === 'X')!
    expect(uniqueOrientations(X.cells)).toHaveLength(3)
  })
  it('I（直線）は6向き（反転で異なる形）', () => {
    const I = PIECES.find(p => p.id === 'I')!
    expect(uniqueOrientations(I.cells)).toHaveLength(6)
  })
  it('C（Chevron）は6向き', () => {
    const C = PIECES.find(p => p.id === 'C')!
    expect(uniqueOrientations(C.cells)).toHaveLength(6)
  })
  it('E（Crown）は6向き', () => {
    const E = PIECES.find(p => p.id === 'E')!
    expect(uniqueOrientations(E.cells)).toHaveLength(6)
  })
  it('V（Lobster）は6向き', () => {
    const V = PIECES.find(p => p.id === 'V')!
    expect(uniqueOrientations(V.cells)).toHaveLength(6)
  })
  it('S（Snake）は6向き', () => {
    const S = PIECES.find(p => p.id === 'S')!
    expect(uniqueOrientations(S.cells)).toHaveLength(6)
  })
  it('P（Sphinx、非対称）は12向き', () => {
    const P = PIECES.find(p => p.id === 'P')!
    expect(uniqueOrientations(P.cells)).toHaveLength(12)
  })
  it('F（Yacht）は12向き', () => {
    const F = PIECES.find(p => p.id === 'F')!
    expect(uniqueOrientations(F.cells)).toHaveLength(12)
  })
  it('G（Shoe）は12向き', () => {
    const G = PIECES.find(p => p.id === 'G')!
    expect(uniqueOrientations(G.cells)).toHaveLength(12)
  })
  it('H（Pistol）は12向き', () => {
    const H = PIECES.find(p => p.id === 'H')!
    expect(uniqueOrientations(H.cells)).toHaveLength(12)
  })
  it('J（Club）は12向き', () => {
    const J = PIECES.find(p => p.id === 'J')!
    expect(uniqueOrientations(J.cells)).toHaveLength(12)
  })
})
