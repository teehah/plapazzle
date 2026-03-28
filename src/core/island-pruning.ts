import type { Cell } from './grid'
import { cellKey } from './grid'

/**
 * 空きセルの連結成分を調べ、ピースサイズの倍数でない成分があれば true を返す。
 * true = この分岐は解がないので枝刈りすべき。
 */
export function hasDeadIsland(
  emptyCells: Cell[],
  neighborsFn: (c: Cell) => Cell[],
  cellsPerPiece: number,
): boolean {
  if (emptyCells.length === 0) return false

  const cellSet = new Set(emptyCells.map(cellKey))
  const visited = new Set<string>()

  for (const cell of emptyCells) {
    const key = cellKey(cell)
    if (visited.has(key)) continue

    // BFS で連結成分を探索
    let size = 0
    const queue: Cell[] = [cell]
    visited.add(key)

    while (queue.length > 0) {
      const cur = queue.pop()!
      size++
      for (const neighbor of neighborsFn(cur)) {
        const nk = cellKey(neighbor)
        if (cellSet.has(nk) && !visited.has(nk)) {
          visited.add(nk)
          queue.push(neighbor)
        }
      }
    }

    if (size % cellsPerPiece !== 0) return true
  }

  return false
}
