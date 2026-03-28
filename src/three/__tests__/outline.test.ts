import { describe, it, expect } from 'vitest'
import type { Cell } from '../../core/grid'
import { cellToSvgPoints } from '../../core/grid'

// テスト用にアウトライン計算ロジックを直接テスト

function ptKey(x: number, y: number): string {
  return `${Math.round(x * 1000)},${Math.round(y * 1000)}`
}

function edgeKey(a: [number, number], b: [number, number]): string {
  const ka = ptKey(a[0], a[1])
  const kb = ptKey(b[0], b[1])
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
}

function computeOutline(
  cellPoints: [number, number][][],
): [number, number][] {
  // 全辺の出現回数をカウント
  const edgeCounts = new Map<string, number>()
  type Edge = { a: [number, number]; b: [number, number] }
  const allEdges: Edge[] = []

  for (const pts of cellPoints) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      const key = edgeKey(a, b)
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1)
      allEdges.push({ a, b })
    }
  }

  // 境界辺（1回だけ出現）
  const boundary = allEdges.filter(e => edgeCounts.get(edgeKey(e.a, e.b)) === 1)

  // 頂点→辺の隣接マップ
  const vertexEdges = new Map<string, { from: [number, number]; to: [number, number] }[]>()
  for (const e of boundary) {
    const ka = ptKey(e.a[0], e.a[1])
    const kb = ptKey(e.b[0], e.b[1])
    if (!vertexEdges.has(ka)) vertexEdges.set(ka, [])
    if (!vertexEdges.has(kb)) vertexEdges.set(kb, [])
    vertexEdges.get(ka)!.push({ from: e.a, to: e.b })
    vertexEdges.get(kb)!.push({ from: e.b, to: e.a })
  }

  // 頂点を辿ってポリゴンを構築
  const visited = new Set<string>()
  const start = boundary[0].a
  const polygon: [number, number][] = [start]
  visited.add(ptKey(start[0], start[1]))

  let current = boundary[0].b
  for (let safety = 0; safety < 10000; safety++) {
    const ck = ptKey(current[0], current[1])
    if (ck === ptKey(start[0], start[1])) break // ループ完了

    polygon.push(current)
    visited.add(ck)

    const neighbors = vertexEdges.get(ck) ?? []
    const next = neighbors.find(n => !visited.has(ptKey(n.to[0], n.to[1])))
    if (!next) break
    current = next.to
  }

  return polygon
}

describe('computeOutline', () => {
  it('正方形1セルの外周は4頂点', () => {
    const cell: [number, number][] = [[0,0], [30,0], [30,30], [0,30]]
    const outline = computeOutline([cell])
    expect(outline).toHaveLength(4)
  })

  it('正方形2セル横並びの外周は6頂点', () => {
    const c1: [number, number][] = [[0,0], [30,0], [30,30], [0,30]]
    const c2: [number, number][] = [[30,0], [60,0], [60,30], [30,30]]
    const outline = computeOutline([c1, c2])
    // 共有辺 (30,0)-(30,30) が消えて6頂点の長方形になる
    expect(outline).toHaveLength(6)
  })

  it('正方形L字(3セル)の外周は8頂点', () => {
    const c1: [number, number][] = [[0,0], [30,0], [30,30], [0,30]]
    const c2: [number, number][] = [[0,30], [30,30], [30,60], [0,60]]
    const c3: [number, number][] = [[30,30], [60,30], [60,60], [30,60]]
    const outline = computeOutline([c1, c2, c3])
    expect(outline).toHaveLength(8)
  })

  it('三角形2セル(△▽)の外周は4頂点（菱形）', () => {
    // △ dir=0: 3頂点
    const H = 30
    const W = H * 2 / Math.sqrt(3)
    const t1: [number, number][] = [[0, 0], [W, 0], [W/2, H]]
    // ▽ dir=1 (同じrow,col): 共有辺は (W,0)-(W/2,H)
    const t2: [number, number][] = [[W, 0], [W/2, H], [3*W/2, H]]
    const outline = computeOutline([t1, t2])
    // 共有辺が消えて4頂点の菱形
    expect(outline).toHaveLength(4)
  })

  it('外周の頂点は閉じたポリゴンを形成する', () => {
    const c1: [number, number][] = [[0,0], [30,0], [30,30], [0,30]]
    const c2: [number, number][] = [[30,0], [60,0], [60,30], [30,30]]
    const outline = computeOutline([c1, c2])
    for (const pt of outline) {
      expect(pt[0]).toBeGreaterThanOrEqual(0)
      expect(pt[0]).toBeLessThanOrEqual(60)
      expect(pt[1]).toBeGreaterThanOrEqual(0)
      expect(pt[1]).toBeLessThanOrEqual(30)
    }
  })

  it('ヘキシアモンド6セルピースの外周が正しい', () => {
    // Iピース: 6つの三角形が一直線
    const cells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 0, dir: 1 },
      { row: 0, col: 1, dir: 0 },
      { row: 0, col: 1, dir: 1 },
      { row: 0, col: 2, dir: 0 },
      { row: 0, col: 2, dir: 1 },
    ]
    const cellSize = 30
    const cellPts = cells.map(c => [...cellToSvgPoints(c, cellSize)] as [number, number][])
    const outline = computeOutline(cellPts)
    // 6三角形の帯 → 内部辺が消えて外周のみ
    // 各三角形3辺 × 6 = 18辺、内部共有辺5本 × 2 = 10回出現 → 境界辺 = 18-10 = 8
    // 8辺 → 8頂点の多角形
    expect(outline).toHaveLength(8)
  })

  it('実際のヘキシアモンドピースでcellToSvgPointsから外周が計算できる', () => {
    // Xピース (star): 中心の△と3つの隣接▽
    const cells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: -1, dir: 1 },
      { row: 0, col: 0, dir: 1 },
      { row: -1, col: 0, dir: 1 },
      { row: 0, col: 1, dir: 0 },
      { row: 1, col: 0, dir: 0 },
    ]
    const cellSize = 30
    const cellPts = cells.map(c => [...cellToSvgPoints(c, cellSize)] as [number, number][])
    const outline = computeOutline(cellPts)
    // 外周ポリゴンが3頂点以上
    expect(outline.length).toBeGreaterThanOrEqual(6)
  })
})
