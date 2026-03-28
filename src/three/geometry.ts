import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { GRID_OPS } from '../core/grid-ops'
import { geometryCenteringOffset } from '../game/bbox'

// ピース形状パラメータ
const RIM_WIDTH = 3.5
const RIM_SLAB = 2
const CENTER_DEPTH = 4

// ボードパラメータ
const BOARD_DEPTH = 2
const BOARD_CELL_INSET = 2.5

/**
 * セル群の SVG ポリゴン頂点配列を返す。
 * computeOutline に渡す形式。
 */
function getCellPolygons(cells: Cell[], cellSize: number, gridType: GridType): [number, number][][] {
  const ops = GRID_OPS[gridType]
  return cells.map(c => [...ops.cellToSvgPoints(c, cellSize)] as [number, number][])
}

function ptKey(x: number, y: number): string {
  return `${Math.round(x * 1000)},${Math.round(y * 1000)}`
}

function edgeKey(a: [number, number], b: [number, number]): string {
  const ka = ptKey(a[0], a[1])
  const kb = ptKey(b[0], b[1])
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
}

/**
 * セル群の外周アウトラインを計算する。
 */
function computeOutline(cellPoints: [number, number][][]): [number, number][] {
  type Edge = { a: [number, number]; b: [number, number] }
  const edgeCounts = new Map<string, number>()
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

  const boundary = allEdges.filter(e => edgeCounts.get(edgeKey(e.a, e.b)) === 1)
  if (boundary.length === 0) return []

  const vertexEdges = new Map<string, { from: [number, number]; to: [number, number] }[]>()
  for (const e of boundary) {
    const ka = ptKey(e.a[0], e.a[1])
    const kb = ptKey(e.b[0], e.b[1])
    if (!vertexEdges.has(ka)) vertexEdges.set(ka, [])
    if (!vertexEdges.has(kb)) vertexEdges.set(kb, [])
    vertexEdges.get(ka)!.push({ from: e.a, to: e.b })
    vertexEdges.get(kb)!.push({ from: e.b, to: e.a })
  }

  const visited = new Set<string>()
  const start = boundary[0].a
  const polygon: [number, number][] = [start]
  visited.add(ptKey(start[0], start[1]))
  let current = boundary[0].b

  for (let safety = 0; safety < 10000; safety++) {
    const ck = ptKey(current[0], current[1])
    if (ck === ptKey(start[0], start[1])) break
    polygon.push(current)
    visited.add(ck)
    const neighbors = vertexEdges.get(ck) ?? []
    const next = neighbors.find(n => !visited.has(ptKey(n.to[0], n.to[1])))
    if (!next) break
    current = next.to
  }

  return polygon
}

/**
 * Shape を作成。ワインディングを反時計回りに正規化。
 */
function createShape(points: [number, number][]): THREE.Shape {
  const flipped = points.map(([x, y]) => [x, -y] as [number, number])
  let area = 0
  for (let i = 0; i < flipped.length; i++) {
    const [x1, y1] = flipped[i]
    const [x2, y2] = flipped[(i + 1) % flipped.length]
    area += (x2 - x1) * (y2 + y1)
  }
  const ordered = area > 0 ? [...flipped].reverse() : flipped

  const shape = new THREE.Shape()
  shape.moveTo(ordered[0][0], ordered[0][1])
  for (let i = 1; i < ordered.length; i++) {
    shape.lineTo(ordered[i][0], ordered[i][1])
  }
  shape.closePath()
  return shape
}

/**
 * ピース用ジオメトリ。
 * bevelOffset=-RIM_WIDTH + bevelSize=RIM_WIDTH + bevelThickness=大 で
 * ほぼ垂直なリム壁を実現。形状はセル境界を超えない。
 */
export function pieceToGeometry(
  cells: Cell[],
  cellSize: number,
  gridType: GridType,
): THREE.BufferGeometry {
  const outline = computeOutline(getCellPolygons(cells, cellSize, gridType))

  if (outline.length < 3) return new THREE.BufferGeometry()

  // 上層: リム天面（外周全体、薄いスラブ）
  const rimShape = createShape(outline)
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, {
    depth: RIM_SLAB,
    bevelEnabled: false,
  })
  rimGeo.translate(0, 0, CENTER_DEPTH)  // 中央部の上に載せる

  // 下層: 中央部（bevelOffset で内側にオフセット、垂直壁）
  const centerShape = createShape(outline)
  const centerGeo = new THREE.ExtrudeGeometry(centerShape, {
    depth: CENTER_DEPTH,
    bevelEnabled: true,
    bevelSize: 0.01,        // ほぼゼロ（見えないベベル）
    bevelThickness: 0.01,
    bevelSegments: 1,
    bevelOffset: -RIM_WIDTH,  // 内側にオフセット → 均一幅の凹み
  })

  const geo = mergeGeometries([rimGeo, centerGeo]) ?? rimGeo
  rimGeo.dispose()
  centerGeo.dispose()

  const center = geometryCenteringOffset(cells, cellSize, gridType)
  geo.translate(-center.x, -center.y, 0)

  return geo
}

/**
 * アウトラインの各頂点を内側にオフセット（マイタージョイン方式）。
 * ポリゴンの巻き方向と各頂点の凸/凹を正確に判定して内向きにオフセットする。
 */
function offsetOutline(outline: [number, number][], offset: number): [number, number][] {
  const n = outline.length

  // ポリゴンの符号付き面積で巻き方向を判定（正=CCW、負=CW）
  let signedArea = 0
  for (let i = 0; i < n; i++) {
    const [x1, y1] = outline[i]
    const [x2, y2] = outline[(i + 1) % n]
    signedArea += (x2 - x1) * (y2 + y1)
  }
  // signedArea > 0 → CW, < 0 → CCW (SVG座標系、Y下向き)
  const cwSign = signedArea > 0 ? 1 : -1

  return outline.map((pt, i) => {
    const prev = outline[(i - 1 + n) % n]
    const next = outline[(i + 1) % n]

    const e1x = pt[0] - prev[0], e1y = pt[1] - prev[1]
    const e2x = next[0] - pt[0], e2y = next[1] - pt[1]
    const e1len = Math.sqrt(e1x * e1x + e1y * e1y) || 1
    const e2len = Math.sqrt(e2x * e2x + e2y * e2y) || 1

    // 辺の単位法線（CWポリゴンの場合、右手法線が内側）
    // CW: 内側法線 = (ey, -ex) / len
    // CCW: 内側法線 = (-ey, ex) / len
    const n1x = cwSign * e1y / e1len
    const n1y = cwSign * (-e1x) / e1len
    const n2x = cwSign * e2y / e2len
    const n2y = cwSign * (-e2x) / e2len

    // 二等分線ベクトル
    let bx = n1x + n2x, by = n1y + n2y
    const blen = Math.sqrt(bx * bx + by * by)

    if (blen < 0.001) {
      // ほぼ平行な辺 → 法線方向にそのままオフセット
      return [pt[0] + n1x * offset, pt[1] + n1y * offset] as [number, number]
    }

    bx /= blen; by /= blen

    // マイター距離 = offset / cos(半角)
    const dot = n1x * bx + n1y * by
    const rawMiter = dot > 0.15 ? offset / dot : offset
    // 距離制限（絶対値で比較して正負どちらのオフセットでも正しく制限）
    const maxDist = Math.abs(offset) * 3
    const miter = Math.abs(rawMiter) > maxDist ? Math.sign(rawMiter) * maxDist : rawMiter

    return [pt[0] + bx * miter, pt[1] + by * miter] as [number, number]
  })
}

/**
 * ピースのリム外縁＋内縁のアウトライン線ジオメトリを返す。
 * 内縁は各辺を個別にオフセットして描画（凹角でのポリゴン破綻を回避）。
 */
export function pieceRimLineGeometry(
  cells: Cell[],
  cellSize: number,
  gridType: GridType,
): { outer: THREE.BufferGeometry; inner: THREE.BufferGeometry } {
  const outline = computeOutline(getCellPolygons(cells, cellSize, gridType))

  const center = geometryCenteringOffset(cells, cellSize, gridType)
  const offX = -center.x
  const offY = -center.y
  const z = CENTER_DEPTH + RIM_SLAB + 0.1

  // 外縁（閉じたループ）
  const outerPts = outline.map(([x, y]) => new THREE.Vector3(x + offX, -y + offY, z))
  outerPts.push(outerPts[0].clone())
  const outerGeo = new THREE.BufferGeometry().setFromPoints(outerPts)

  // 内縁（RIM_WIDTH 分内側にオフセット）
  const innerOutline = offsetOutline(outline, RIM_WIDTH)
  const innerPts = innerOutline.map(([x, y]) => new THREE.Vector3(x + offX, -y + offY, z))
  innerPts.push(innerPts[0].clone())
  const innerGeo = new THREE.BufferGeometry().setFromPoints(innerPts)

  return { outer: outerGeo, inner: innerGeo }
}

/**
 * ボード外枠リムのジオメトリ。ボード外周の外側にフレームを作る。
 */
export function boardFrameGeometry(
  cells: Cell[],
  cellSize: number,
  gridType: GridType,
): THREE.BufferGeometry {
  const outline = computeOutline(getCellPolygons(cells, cellSize, gridType))
  if (outline.length < 3) return new THREE.BufferGeometry()

  const FRAME_WIDTH = 5.0
  const FRAME_DEPTH = CENTER_DEPTH + RIM_SLAB

  // 外側にオフセット（offsetOutline に負値で外向き）
  const outerOutline = offsetOutline(outline, -FRAME_WIDTH)

  // 外枠: outerOutline を外周、outline を穴にしたリング
  const outerShape = createShape(outerOutline)

  // 穴（元のアウトライン）— ワインディングを外周と逆にする
  const flipped = outline.map(([x, y]) => [x, -y] as [number, number])
  let area = 0
  for (let i = 0; i < flipped.length; i++) {
    const [x1, y1] = flipped[i]
    const [x2, y2] = flipped[(i + 1) % flipped.length]
    area += (x2 - x1) * (y2 + y1)
  }
  // 穴は外周と逆巻き
  const holeOrdered = area > 0 ? flipped : [...flipped].reverse()

  const holePath = new THREE.Path()
  holePath.moveTo(holeOrdered[0][0], holeOrdered[0][1])
  for (let i = 1; i < holeOrdered.length; i++) {
    holePath.lineTo(holeOrdered[i][0], holeOrdered[i][1])
  }
  holePath.closePath()
  outerShape.holes.push(holePath)

  const geo = new THREE.ExtrudeGeometry(outerShape, {
    depth: FRAME_DEPTH,
    bevelEnabled: false,
  })

  const center = geometryCenteringOffset(cells, cellSize, gridType)
  geo.translate(-center.x, -center.y, 0)

  return geo
}

/**
 * ボード外枠のアウトライン線ジオメトリ（外縁＋内縁）。
 */
export function boardFrameLineGeometry(
  cells: Cell[],
  cellSize: number,
  gridType: GridType,
): { outer: THREE.BufferGeometry; inner: THREE.BufferGeometry } {
  const outline = computeOutline(getCellPolygons(cells, cellSize, gridType))

  const FRAME_WIDTH = 5.0
  const outerOutline = offsetOutline(outline, -FRAME_WIDTH)

  const center = geometryCenteringOffset(cells, cellSize, gridType)
  const offX = -center.x
  const offY = -center.y
  const z = CENTER_DEPTH + RIM_SLAB + 0.1

  // 外縁（フレーム外側）
  const outerPts = outerOutline.map(([x, y]) => new THREE.Vector3(x + offX, -y + offY, z))
  outerPts.push(outerPts[0].clone())
  const outerGeo = new THREE.BufferGeometry().setFromPoints(outerPts)

  // 内縁（フレーム内側 = ボード外周）
  const innerPts = outline.map(([x, y]) => new THREE.Vector3(x + offX, -y + offY, z))
  innerPts.push(innerPts[0].clone())
  const innerGeo = new THREE.BufferGeometry().setFromPoints(innerPts)

  return { outer: outerGeo, inner: innerGeo }
}

/**
 * ボード用ジオメトリ: 各セルを個別にインセット＋押し出し（グリッド表示）。
 */
export function cellsToGeometry(
  cells: Cell[],
  cellSize: number,
  gridType: GridType,
): THREE.BufferGeometry {
  const ops = GRID_OPS[gridType]
  const geometries: THREE.ExtrudeGeometry[] = []

  for (const cell of cells) {
    const rawPts = ops.cellToSvgPoints(cell, cellSize)

    const shape = new THREE.Shape()
    shape.moveTo(rawPts[0][0], -rawPts[0][1])
    for (let i = 1; i < rawPts.length; i++) {
      shape.lineTo(rawPts[i][0], -rawPts[i][1])
    }
    shape.closePath()

    geometries.push(
      new THREE.ExtrudeGeometry(shape, {
        depth: BOARD_DEPTH,
        bevelEnabled: true,
        bevelSize: 0.01,
        bevelThickness: 0.01,
        bevelSegments: 1,
        bevelOffset: -BOARD_CELL_INSET,
      }),
    )
  }

  if (geometries.length === 0) return new THREE.BufferGeometry()
  let result: THREE.BufferGeometry
  if (geometries.length === 1) result = geometries[0]
  else {
    result = mergeGeometries(geometries) ?? geometries[0]
    geometries.forEach(g => g.dispose())
  }

  result.computeBoundingBox()
  const box = result.boundingBox!
  result.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, 0)
  return result
}
