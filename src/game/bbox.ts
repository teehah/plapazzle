import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { GRID_OPS } from '../core/grid-ops'

/**
 * SVG 頂点座標系での bounding box。
 */
export type SvgBbox = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * SVG 座標の配列から bounding box を計算する。
 */
export function svgPointsBbox(allPoints: [number, number][]): SvgBbox {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [px, py] of allPoints) {
    if (px < minX) minX = px
    if (px > maxX) maxX = px
    if (py < minY) minY = py
    if (py > maxY) maxY = py
  }
  return { minX, maxX, minY, maxY }
}

/**
 * セル群の SVG 頂点座標 bounding box を計算する。
 * geometry.ts, coords.ts, snap.ts, state.ts 等で共通利用。
 */
export function svgCellsBbox(
  cells: Cell[],
  cellSize: number,
  gridType: GridType,
): SvgBbox {
  const ops = GRID_OPS[gridType]
  const allPoints: [number, number][] = []
  for (const cell of cells) {
    const pts = ops.cellToSvgPoints(cell, cellSize)
    for (const pt of pts) {
      allPoints.push(pt)
    }
  }
  return svgPointsBbox(allPoints)
}

/**
 * セル群の SVG bounding box 中心を返す。
 * cellsToGeometry のセンタリングと一致する。
 */
export function svgBboxCenter(
  cells: Cell[],
  cellSize: number,
  gridType: GridType,
): { x: number; y: number } {
  const bbox = svgCellsBbox(cells, cellSize, gridType)
  return { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 }
}

/**
 * セル群の SVG bbox half-extent を返す。
 */
export function svgBboxHalfExtent(
  cells: Cell[],
  cellSize: number,
  gridType: GridType,
): { hw: number; hh: number } {
  const bbox = svgCellsBbox(cells, cellSize, gridType)
  return {
    hw: (bbox.maxX - bbox.minX) / 2,
    hh: (bbox.maxY - bbox.minY) / 2,
  }
}

/**
 * geometry.ts のセンタリングオフセットを計算する。
 * geometry.ts は x = svgX, y = -svgY で Shape を作り、
 * 結果のジオメトリを bbox 中心でセンタリングする。
 *
 * このオフセットは (centerSvgX, -centerSvgY) の形式で返す。
 */
export function geometryCenteringOffset(
  cells: Cell[],
  cellSize: number,
  gridType: GridType,
): { x: number; y: number } {
  const ops = GRID_OPS[gridType]
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const cell of cells) {
    const pts = ops.cellToSvgPoints(cell, cellSize)
    for (const [px, py] of pts) {
      // geometry.ts と同じ座標系: x = svgX, y = -svgY
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (-py < minY) minY = -py
      if (-py > maxY) maxY = -py
    }
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}
