import type { Solution } from '../core/solver'
import type { Cell } from '../core/grid'
import type { PieceDef } from '../core/piece'
import { cellKey } from '../core/grid'
import type { GridOps } from '../core/grid-ops'

const CELL_SIZE = 30

// HSL で等間隔に色を生成（任意のピース数に対応）
function buildColorMap(pieces: PieceDef[]): Record<string, string> {
  const uniqueIds = [...new Set(pieces.map(p => p.id))]
  const map: Record<string, string> = {}
  for (let i = 0; i < uniqueIds.length; i++) {
    const hue = (i * 360 / uniqueIds.length) % 360
    map[uniqueIds[i]] = `hsl(${hue}, 70%, 55%)`
  }
  return map
}

function pointsStr(pts: [number, number][]): string {
  return pts.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

type Props = { cells: Cell[]; pieces: PieceDef[]; grid: GridOps; solution: Solution | null }

export function Board({ cells, pieces, grid, solution }: Props) {
  const pieceColors = buildColorMap(pieces)

  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0
  for (const cell of cells) {
    const pts = grid.cellToSvgPoints(cell, CELL_SIZE)
    for (const [x, y] of pts) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  const width = maxX - minX
  const height = maxY - minY

  return (
    <svg
      width={width + 4}
      height={height + 4}
      style={{ display: 'block', margin: '0 auto' }}
    >
      <g transform={`translate(${2 - minX},${2 - minY})`}>
        {cells.map(cell => {
          const key = cellKey(cell)
          const pts = grid.cellToSvgPoints(cell, CELL_SIZE)
          const pieceId = solution?.get(key)
          const fill = pieceId ? pieceColors[pieceId] ?? '#ccc' : '#f0f0f0'
          return (
            <polygon
              key={key}
              points={pointsStr(pts)}
              fill={fill}
              stroke="#333"
              strokeWidth={0.5}
            />
          )
        })}
      </g>
    </svg>
  )
}
