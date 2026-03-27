import type { Cell } from './grid'

// --- 変換 ---

/** 60°回転（三角グリッド上） */
function rotate60(c: Cell): Cell {
  return {
    row: -c.col - 1,
    col: c.row + c.col + c.dir,
    dir: (1 - c.dir) as 0 | 1,
  }
}

/** 左右ミラー（反転） */
function mirror(c: Cell): Cell {
  return {
    row: -(c.row + c.col + c.dir),
    col: c.col,
    dir: c.dir,
  }
}

/** 正規化: 最小row/colが0になるよう平行移動し、ソートする */
export function normalize(cells: Cell[]): Cell[] {
  const minRow = Math.min(...cells.map(c => c.row))
  const minCol = Math.min(...cells.map(c => c.col))
  return cells
    .map(c => ({ row: c.row - minRow, col: c.col - minCol, dir: c.dir }))
    .sort((a, b) => a.row - b.row || a.col - b.col || a.dir - b.dir)
}

function cellsKey(cells: Cell[]): string {
  return normalize(cells)
    .map(c => `${c.row},${c.col},${c.dir}`)
    .join('|')
}

/** 回転×6 + 反転×6 = 最大12向きから重複を除いて返す */
export function uniqueOrientations(cells: Cell[]): Cell[][] {
  const seen = new Set<string>()
  const result: Cell[][] = []
  let cur = [...cells]
  for (let flip = 0; flip < 2; flip++) {
    for (let rot = 0; rot < 6; rot++) {
      const key = cellsKey(cur)
      if (!seen.has(key)) {
        seen.add(key)
        result.push(normalize(cur))
      }
      cur = cur.map(rotate60)
    }
    cur = cells.map(mirror)
  }
  return result
}

export type PieceDef = { id: string; cells: Cell[] }

function c(row: number, col: number, dir: 0 | 1): Cell {
  return { row, col, dir }
}

/**
 * 12種のヘキサモンド（6セルのポリアモンド）定義
 * 座標は puzzler.sourceforge.net の Triangular3D 座標系に基づく
 * 向き数: O=1, X=3, I/C/E/V/S=6, P/F/G/H/J=12
 */
export const PIECES: PieceDef[] = [
  {
    id: 'I', // Bar（直線/菱形）: 6向き
    cells: [c(0,0,0), c(0,0,1), c(1,0,0), c(1,0,1), c(2,0,0), c(2,0,1)],
  },
  {
    id: 'O', // Hexagon（正六角形）: 1向き
    cells: [c(0,0,0), c(0,0,1), c(1,0,0), c(0,-1,1), c(1,-1,0), c(1,-1,1)],
  },
  {
    id: 'X', // Butterfly（蝶）: 3向き
    cells: [c(0,0,0), c(0,0,1), c(1,0,0), c(1,0,1), c(0,1,0), c(1,-1,1)],
  },
  {
    id: 'C', // Chevron/Bat（シェブロン）: 6向き
    cells: [c(0,0,0), c(0,0,1), c(1,0,0), c(1,0,1), c(1,1,0), c(1,1,1)],
  },
  {
    id: 'E', // Crown（王冠）: 6向き
    cells: [c(0,0,0), c(0,0,1), c(1,0,0), c(1,0,1), c(2,0,0), c(1,-1,1)],
  },
  {
    id: 'P', // Sphinx（スフィンクス）: 12向き
    cells: [c(0,0,0), c(0,0,1), c(1,0,0), c(1,0,1), c(2,0,0), c(1,1,0)],
  },
  {
    id: 'F', // Yacht（ヨット）: 12向き
    cells: [c(0,0,0), c(0,0,1), c(1,0,0), c(1,0,1), c(0,1,0), c(1,1,0)],
  },
  {
    id: 'V', // Lobster（ロブスター）: 6向き
    cells: [c(0,0,0), c(0,0,1), c(1,0,0), c(1,0,1), c(0,1,0), c(0,1,1)],
  },
  {
    id: 'S', // Snake（蛇）: 6向き
    cells: [c(0,0,0), c(0,0,1), c(1,0,0), c(1,0,1), c(0,-1,1), c(1,1,0)],
  },
  {
    id: 'J', // Club/Crook（クラブ）: 12向き
    cells: [c(0,0,0), c(0,0,1), c(1,0,0), c(1,0,1), c(2,0,0), c(0,-1,1)],
  },
  {
    id: 'H', // Pistol/Signpost（ピストル）: 12向き
    cells: [c(0,0,0), c(0,0,1), c(1,0,0), c(1,0,1), c(1,-1,1), c(2,-1,0)],
  },
  {
    id: 'G', // Shoe/Hook（シュー）: 12向き
    cells: [c(0,0,0), c(0,0,1), c(1,0,0), c(1,0,1), c(1,1,0), c(0,1,1)],
  },
]
