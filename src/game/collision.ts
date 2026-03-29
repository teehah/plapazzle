import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { svgCellsBbox } from './bbox'

export type Rect = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.maxX > b.minX && a.minX < b.maxX && a.maxY > b.minY && a.minY < b.maxY
}

/**
 * ピースのワールド座標 bbox を返す。
 * ジオメトリはセンタリング済みなので、meshPos を中心に half-extent 分広がる。
 */
export function computePieceWorldBbox(
  orientedCells: Cell[],
  cellSize: number,
  gridType: GridType,
  meshPos: { x: number; y: number },
): Rect {
  const svgBbox = svgCellsBbox(orientedCells, cellSize, gridType)
  const halfW = (svgBbox.maxX - svgBbox.minX) / 2
  const halfH = (svgBbox.maxY - svgBbox.minY) / 2
  return {
    minX: meshPos.x - halfW, maxX: meshPos.x + halfW,
    minY: meshPos.y - halfH, maxY: meshPos.y + halfH,
  }
}

/**
 * ボードのワールド座標 bbox を返す。
 * ジオメトリはセンタリング済みなので、原点を中心に half-extent 分広がる。
 */
export function computeBoardWorldBbox(
  boardCells: Cell[],
  cellSize: number,
  gridType: GridType,
): Rect {
  const svgBbox = svgCellsBbox(boardCells, cellSize, gridType)
  const halfW = (svgBbox.maxX - svgBbox.minX) / 2
  const halfH = (svgBbox.maxY - svgBbox.minY) / 2
  return { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH }
}

function padRect(rect: Rect, margin: number): Rect {
  return {
    minX: rect.minX - margin,
    maxX: rect.maxX + margin,
    minY: rect.minY - margin,
    maxY: rect.maxY + margin,
  }
}

/**
 * half-extent + margin から、位置 (x,y) での padded bbox を作り障害物と重なるか判定。
 * bbox の形状は位置に依存しないため、half-extent を事前計算して渡す。
 */
function hasOverlapAtFast(
  x: number, y: number,
  halfW: number, halfH: number,
  margin: number,
  obstacles: Rect[],
): boolean {
  const padded: Rect = {
    minX: x - halfW - margin, maxX: x + halfW + margin,
    minY: y - halfH - margin, maxY: y + halfH + margin,
  }
  for (const obs of obstacles) {
    if (rectsOverlap(padded, obs)) return true
  }
  return false
}

/**
 * ピースが障害物と重なっているか判定する。
 */
export function hasObstacleOverlap(
  piecePos: { x: number; y: number },
  orientedCells: Cell[],
  cellSize: number,
  gridType: GridType,
  obstacles: Rect[],
): boolean {
  const svgBbox = svgCellsBbox(orientedCells, cellSize, gridType)
  const halfW = (svgBbox.maxX - svgBbox.minX) / 2
  const halfH = (svgBbox.maxY - svgBbox.minY) / 2
  return hasOverlapAtFast(piecePos.x, piecePos.y, halfW, halfH, cellSize * 0.1, obstacles)
}

/**
 * ピースが障害物（ボード＋他ピース）と重なっている場合、
 * ピース位置から放射状に複数方向を探索し、最短の空き位置にはじき出す。
 * 重なりがなければ null。
 */
export function pushOutOfObstacles(
  piecePos: { x: number; y: number },
  orientedCells: Cell[],
  cellSize: number,
  gridType: GridType,
  obstacles: Rect[],
): { x: number; y: number } | null {
  const margin = cellSize * 0.1
  const step = cellSize * 0.5
  const maxSteps = 20
  const numDirs = 12

  // half-extent を1回だけ計算（ループ内で再計算しない）
  const svgBbox = svgCellsBbox(orientedCells, cellSize, gridType)
  const halfW = (svgBbox.maxX - svgBbox.minX) / 2
  const halfH = (svgBbox.maxY - svgBbox.minY) / 2

  if (!hasOverlapAtFast(piecePos.x, piecePos.y, halfW, halfH, margin, obstacles)) {
    return null
  }

  let bestPos: { x: number; y: number } | null = null
  let bestDist = Infinity

  for (let d = 0; d < numDirs; d++) {
    const angle = (2 * Math.PI * d) / numDirs
    const dirX = Math.cos(angle)
    const dirY = Math.sin(angle)

    for (let s = 1; s <= maxSteps; s++) {
      const x = piecePos.x + dirX * step * s
      const y = piecePos.y + dirY * step * s
      if (!hasOverlapAtFast(x, y, halfW, halfH, margin, obstacles)) {
        const dist = s * step
        if (dist < bestDist) {
          bestDist = dist
          bestPos = { x, y }
        }
        break
      }
    }
  }

  return bestPos
}

/**
 * ピースが画面外に出ていたら画面内にクランプする。
 */
export function clampToViewport(
  piecePos: { x: number; y: number },
  orientedCells: Cell[],
  cellSize: number,
  gridType: GridType,
  viewport: { width: number; height: number },
): { x: number; y: number } | null {
  const pBbox = computePieceWorldBbox(orientedCells, cellSize, gridType, piecePos)
  const vw = viewport.width / 2
  const vh = viewport.height / 2
  let x = piecePos.x
  let y = piecePos.y
  let clamped = false

  if (pBbox.minX < -vw) { x += -vw - pBbox.minX; clamped = true }
  else if (pBbox.maxX > vw) { x += vw - pBbox.maxX; clamped = true }
  if (pBbox.minY < -vh) { y += -vh - pBbox.minY; clamped = true }
  else if (pBbox.maxY > vh) { y += vh - pBbox.maxY; clamped = true }

  return clamped ? { x, y } : null
}
