import type { Cell } from '../core/grid'

function c(row: number, col: number, dir: 0 | 1): Cell {
  return { row, col, dir }
}

/**
 * ヘキサモンド 72セルボード定義 -- 不規則六角形
 * 出典: puzzler.sourceforge.net HexiamondsTenyo 座標系
 *
 * 座標系: puzzler の Triangular3D (x, y, z) をそのまま (row, col, dir) に対応
 *   x -> row, y -> col, z -> dir
 *
 * 生成ロジック (Python):
 *   for z in range(2):
 *     for y in range(8):
 *       for x in range(7):
 *         xyz = x + y + z
 *         if (((xyz > 4) or (x > 0 and xyz > 3))
 *             and ((xyz < 9) or (x < 6 and xyz < 10) or (x < 5 and xyz < 11))):
 *           yield (x, y, z)
 */
export const NO6_BOARD = {
  cells: [
    // y=0 (col=0)
    c(3,0,1),
    c(4,0,0), c(4,0,1),
    c(5,0,0), c(5,0,1),
    c(6,0,0), c(6,0,1),
    // y=1 (col=1)
    c(2,1,1),
    c(3,1,0), c(3,1,1),
    c(4,1,0), c(4,1,1),
    c(5,1,0), c(5,1,1),
    c(6,1,0), c(6,1,1),
    // y=2 (col=2)
    c(1,2,1),
    c(2,2,0), c(2,2,1),
    c(3,2,0), c(3,2,1),
    c(4,2,0), c(4,2,1),
    c(5,2,0), c(5,2,1),
    c(6,2,0),
    // y=3 (col=3)
    c(1,3,0), c(1,3,1),
    c(2,3,0), c(2,3,1),
    c(3,3,0), c(3,3,1),
    c(4,3,0), c(4,3,1),
    c(5,3,0), c(5,3,1),
    // y=4 (col=4)
    c(0,4,1),
    c(1,4,0), c(1,4,1),
    c(2,4,0), c(2,4,1),
    c(3,4,0), c(3,4,1),
    c(4,4,0), c(4,4,1),
    c(5,4,0),
    // y=5 (col=5)
    c(0,5,0), c(0,5,1),
    c(1,5,0), c(1,5,1),
    c(2,5,0), c(2,5,1),
    c(3,5,0), c(3,5,1),
    c(4,5,0), c(4,5,1),
    // y=6 (col=6)
    c(0,6,0), c(0,6,1),
    c(1,6,0), c(1,6,1),
    c(2,6,0), c(2,6,1),
    c(3,6,0), c(3,6,1),
    c(4,6,0),
    // y=7 (col=7)
    c(0,7,0), c(0,7,1),
    c(1,7,0), c(1,7,1),
    c(2,7,0), c(2,7,1),
    c(3,7,0),
  ] as Cell[]
}
