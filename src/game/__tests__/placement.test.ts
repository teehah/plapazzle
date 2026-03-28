import { describe, it, expect } from 'vitest'
import { gridToWorld, worldToNearestGrid, getOrientedCells, getPlacedCells } from '../placement'
import type { Cell } from '../../core/grid'

describe('gridToWorld (triangular)', () => {
  const H = 30
  it('(0,0,0) のワールド座標中心を返す', () => {
    const pos = gridToWorld({ row: 0, col: 0, dir: 0 }, H, 'triangular')
    // △(0,0) centroid: avg of 3 SVG vertices
    expect(typeof pos.x).toBe('number')
    expect(typeof pos.y).toBe('number')
    expect(pos.x).toBeGreaterThan(0)
  })
})

describe('gridToWorld (square)', () => {
  it('(0,0,0) のワールド座標中心を返す', () => {
    const pos = gridToWorld({ row: 0, col: 0, dir: 0 }, 30, 'square')
    expect(pos.x).toBeCloseTo(15)
    expect(pos.y).toBeCloseTo(15)
  })
  it('(1,2,0) のワールド座標中心を返す', () => {
    const pos = gridToWorld({ row: 1, col: 2, dir: 0 }, 30, 'square')
    expect(pos.x).toBeCloseTo(75) // col*30 + 15
    expect(pos.y).toBeCloseTo(45) // row*30 + 15
  })
})

describe('worldToNearestGrid', () => {
  const board: Cell[] = [
    { row: 0, col: 0, dir: 0 },
    { row: 0, col: 1, dir: 0 },
    { row: 1, col: 0, dir: 0 },
  ]
  it('最も近いセルを返す (square)', () => {
    const cell = worldToNearestGrid(16, 16, 30, 'square', board)
    expect(cell).toEqual({ row: 0, col: 0, dir: 0 })
  })
  it('(0,1) の近くなら (0,1) を返す (square)', () => {
    const cell = worldToNearestGrid(44, 14, 30, 'square', board)
    expect(cell).toEqual({ row: 0, col: 1, dir: 0 })
  })
  it('空のボードならnull', () => {
    const cell = worldToNearestGrid(0, 0, 30, 'square', [])
    expect(cell).toBeNull()
  })
})

describe('getOrientedCells', () => {
  const piece = { id: 'T', cells: [
    { row: 0, col: 0, dir: 0 as const },
    { row: 0, col: 1, dir: 0 as const },
    { row: 0, col: 2, dir: 0 as const },
    { row: 1, col: 1, dir: 0 as const },
  ]}
  it('orientationIndex=0 は正規化されたセルを返す', () => {
    const cells = getOrientedCells(piece, 0, false, 'square')
    expect(cells).toHaveLength(4)
  })
  it('orientationIndex=1 は回転したセルを返す', () => {
    const c0 = getOrientedCells(piece, 0, false, 'square')
    const c1 = getOrientedCells(piece, 1, false, 'square')
    const k0 = c0.map(c => `${c.row},${c.col}`).join('|')
    const k1 = c1.map(c => `${c.row},${c.col}`).join('|')
    expect(k0).not.toBe(k1)
  })
})

describe('getPlacedCells', () => {
  it('gridPosition に基づいてセルを平行移動する', () => {
    const cells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
    ]
    const placed = getPlacedCells(cells, { row: 2, col: 3 })
    expect(placed).toContainEqual({ row: 2, col: 3, dir: 0 })
    expect(placed).toContainEqual({ row: 2, col: 4, dir: 0 })
  })
})
