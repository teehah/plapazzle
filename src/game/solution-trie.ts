/**
 * 解法データからトライを構築する。
 *
 * トライの各レベルは pieceOrder の各ピースに対応し、
 * エッジラベルはそのピースの placement key。
 */

import type { SolutionData } from './solution-loader'

export type TrieNode = {
  /** この level でのピースの placement key */
  placementKey: string
  /** 子ノード */
  children: TrieNode[]
  /** このノードを経由する解法の数 */
  solutionCount: number
  /** リーフの場合: 解法インデックス */
  solutionIds: number[]
}

function createNode(placementKey: string): TrieNode {
  return {
    placementKey,
    children: [],
    solutionCount: 0,
    solutionIds: [],
  }
}

/**
 * SolutionData からトライを構築して root ノードを返す。
 * root の placementKey は空文字列。
 */
export function buildSolutionTrie(data: SolutionData): TrieNode {
  const root = createNode('')
  const pieceCount = data.pieceOrder.length

  for (let si = 0; si < data.placements.length; si++) {
    const solution = data.placements[si]
    let node = root
    node.solutionCount++

    for (let pi = 0; pi < pieceCount; pi++) {
      const key = solution[pi]

      // 子ノードを探す（線形探索 — 子の数は少ないため十分高速）
      let child = node.children.find(c => c.placementKey === key)
      if (!child) {
        child = createNode(key)
        node.children.push(child)
      }

      child.solutionCount++

      if (pi === pieceCount - 1) {
        // リーフレベル
        child.solutionIds.push(si)
      }

      node = child
    }
  }

  return root
}
