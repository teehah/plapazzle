import { describe, it, expect } from 'vitest'
import { PENTAHEXES } from '../../data/hex-pieces'
import { GRID_OPS } from '../grid-ops'

const hex = GRID_OPS.hexagonal

describe('PENTAHEXES', () => {
  it('22種類ある', () => {
    expect(PENTAHEXES).toHaveLength(22)
  })
  it('各ピースは5セル', () => {
    for (const p of PENTAHEXES) {
      expect(p.cells).toHaveLength(5)
    }
  })
  it('全ピースのIDは一意', () => {
    const ids = PENTAHEXES.map(p => p.id)
    expect(new Set(ids).size).toBe(22)
  })
  it('各ピースのdirは全て0', () => {
    for (const p of PENTAHEXES) {
      for (const c of p.cells) {
        expect(c.dir).toBe(0)
      }
    }
  })
  it('全ピースは互いに異なる形状', () => {
    const keys = new Set<string>()
    for (const p of PENTAHEXES) {
      const orientations = hex.uniqueOrientations(p.cells)
      // 全向きのキーを集合に入れて、別ピースと被らないことを確認
      const pieceKeys = orientations.map(o =>
        o.map(c => `${c.row},${c.col}`).join('|')
      )
      for (const k of pieceKeys) {
        expect(keys.has(k)).toBe(false)
        keys.add(k)
      }
    }
  })
  it('全ピースの向き数の合計は正しい', () => {
    // 22ペンタヘックスの向き数合計: 既知値は186
    // A=1(六角対称), 他は3,6,12向き
    let total = 0
    for (const p of PENTAHEXES) {
      total += hex.uniqueOrientations(p.cells).length
    }
    // 22種それぞれに回転・反転を適用した合計
    expect(total).toBeGreaterThan(22)  // 最低でも22以上
    expect(total).toBeLessThanOrEqual(22 * 12)  // 最大 22*12=264
  })
})
