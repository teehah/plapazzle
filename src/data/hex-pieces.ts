import type { PieceDef } from '../core/piece'
import type { Cell } from '../core/grid'

function c(row: number, col: number): Cell {
  return { row, col, dir: 0 }
}

/**
 * ペンタヘックス全22種（5格正六角形 free polyhex）
 * axial座標系 (row=r, col=q)
 * BFS列挙で生成、canonical form で重複排除済み
 */
export const PENTAHEXES: PieceDef[] = [
  { id: 'PH01', cells: [c(0,0), c(0,1), c(0,2), c(0,3), c(0,4)] },
  { id: 'PH02', cells: [c(0,0), c(1,0), c(1,1), c(1,2), c(1,3)] },
  { id: 'PH03', cells: [c(0,1), c(1,0), c(1,1), c(1,2), c(1,3)] },
  { id: 'PH04', cells: [c(0,2), c(1,0), c(1,1), c(1,2), c(1,3)] },
  { id: 'PH05', cells: [c(0,0), c(0,1), c(1,0), c(1,1), c(1,2)] },
  { id: 'PH06', cells: [c(0,0), c(0,1), c(1,1), c(1,2), c(1,3)] },
  { id: 'PH07', cells: [c(0,0), c(1,0), c(2,0), c(2,1), c(2,2)] },
  { id: 'PH08', cells: [c(0,1), c(1,0), c(2,0), c(2,1), c(2,2)] },
  { id: 'PH09', cells: [c(0,0), c(1,0), c(1,1), c(1,2), c(2,0)] },
  { id: 'PH10', cells: [c(0,1), c(1,1), c(1,2), c(1,3), c(2,0)] },
  { id: 'PH11', cells: [c(0,0), c(0,2), c(1,0), c(1,1), c(1,2)] },
  { id: 'PH12', cells: [c(0,0), c(1,0), c(1,1), c(1,2), c(2,1)] },
  { id: 'PH13', cells: [c(0,0), c(0,3), c(1,0), c(1,1), c(1,2)] },
  { id: 'PH14', cells: [c(0,0), c(1,0), c(1,1), c(1,2), c(2,2)] },
  { id: 'PH15', cells: [c(0,1), c(0,2), c(1,0), c(1,1), c(1,2)] },
  { id: 'PH16', cells: [c(0,2), c(1,1), c(2,0), c(2,1), c(2,2)] },
  { id: 'PH17', cells: [c(0,1), c(1,0), c(1,1), c(1,2), c(2,0)] },
  { id: 'PH18', cells: [c(0,1), c(1,0), c(1,1), c(1,2), c(2,1)] },
  { id: 'PH19', cells: [c(0,0), c(1,0), c(1,1), c(2,1), c(2,2)] },
  { id: 'PH20', cells: [c(0,1), c(0,2), c(1,0), c(1,2), c(1,3)] },
  { id: 'PH21', cells: [c(0,2), c(1,0), c(1,1), c(2,1), c(2,2)] },
  { id: 'PH22', cells: [c(0,1), c(0,2), c(1,0), c(2,0), c(2,1)] },
]
