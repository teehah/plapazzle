import type { Solution } from '../core/solver'
import type { Cell } from '../core/grid'
import { cellKey, cellToSvgPoints } from '../core/grid'

const H = 30  // triangle height in px

const PIECE_COLORS: Record<string, string> = {
  I: '#e74c3c', O: '#3498db', X: '#2ecc71', C: '#f39c12',
  E: '#9b59b6', P: '#1abc9c', F: '#e67e22', V: '#34495e',
  S: '#e91e63', J: '#00bcd4', H: '#8bc34a', G: '#ff5722',
}

function pointsStr(pts: [[number,number],[number,number],[number,number]]): string {
  return pts.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

type Props = { cells: Cell[]; solution: Solution | null }

export function Board({ cells, solution }: Props) {

  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0
  for (const cell of cells) {
    const pts = cellToSvgPoints(cell, H)
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
          const pts = cellToSvgPoints(cell, H)
          const pieceId = solution?.get(key)
          const fill = pieceId ? PIECE_COLORS[pieceId] ?? '#ccc' : '#f0f0f0'
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
