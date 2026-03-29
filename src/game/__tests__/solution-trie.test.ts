import { describe, it, expect } from 'vitest'
import { buildSolutionTrie, type TrieNode } from '../solution-trie'
import type { SolutionData } from '../solution-loader'

/** トライのノード総数を再帰的にカウント */
function countNodes(node: TrieNode): number {
  let count = 1
  for (const child of node.children) {
    count += countNodes(child)
  }
  return count
}

/** 全リーフの solutionIds をフラットに収集 */
function collectLeafSolutionIds(node: TrieNode): number[] {
  if (node.children.length === 0) {
    return [...node.solutionIds]
  }
  const ids: number[] = []
  for (const child of node.children) {
    ids.push(...collectLeafSolutionIds(child))
  }
  return ids
}

describe('buildSolutionTrie', () => {
  it('should build a trie from a single solution', () => {
    const data: SolutionData = {
      pieceOrder: ['A', 'B'],
      placements: [['keyA1', 'keyB1']],
    }

    const root = buildSolutionTrie(data)

    expect(root.placementKey).toBe('')
    expect(root.solutionCount).toBe(1)
    expect(root.children).toHaveLength(1)

    const childA = root.children[0]
    expect(childA.placementKey).toBe('keyA1')
    expect(childA.solutionCount).toBe(1)
    expect(childA.children).toHaveLength(1)

    const childB = childA.children[0]
    expect(childB.placementKey).toBe('keyB1')
    expect(childB.solutionCount).toBe(1)
    expect(childB.solutionIds).toEqual([0])
  })

  it('should share prefix nodes when solutions have the same placement for early pieces', () => {
    const data: SolutionData = {
      pieceOrder: ['A', 'B'],
      placements: [
        ['shared', 'b1'],
        ['shared', 'b2'],
      ],
    }

    const root = buildSolutionTrie(data)

    // Root has 1 child (shared A placement)
    expect(root.children).toHaveLength(1)
    expect(root.solutionCount).toBe(2)

    const childA = root.children[0]
    expect(childA.placementKey).toBe('shared')
    expect(childA.solutionCount).toBe(2)
    // Two different B placements
    expect(childA.children).toHaveLength(2)

    const b1 = childA.children.find(c => c.placementKey === 'b1')!
    const b2 = childA.children.find(c => c.placementKey === 'b2')!
    expect(b1.solutionIds).toEqual([0])
    expect(b2.solutionIds).toEqual([1])
  })

  it('should have separate branches when placements differ at root level', () => {
    const data: SolutionData = {
      pieceOrder: ['A', 'B'],
      placements: [
        ['a1', 'b1'],
        ['a2', 'b2'],
      ],
    }

    const root = buildSolutionTrie(data)

    expect(root.children).toHaveLength(2)
    expect(root.solutionCount).toBe(2)
  })

  it('should correctly count nodes (compression test)', () => {
    // 3 pieces, 4 solutions where first piece has 2 unique placements
    const data: SolutionData = {
      pieceOrder: ['X', 'Y', 'Z'],
      placements: [
        ['x1', 'y1', 'z1'],
        ['x1', 'y1', 'z2'],
        ['x1', 'y2', 'z3'],
        ['x2', 'y3', 'z4'],
      ],
    }

    const root = buildSolutionTrie(data)

    // root -> x1 -> y1 -> z1, z2
    //                y2 -> z3
    //         x2 -> y3 -> z4
    // Total: 1 (root) + 2 (x1,x2) + 3 (y1,y2,y3) + 4 (z1,z2,z3,z4) = 10
    expect(countNodes(root)).toBe(10)

    // Without trie (naive): 1 + 3 * 4 = 13
    // Trie saves 3 nodes
  })

  it('should store all solution IDs at leaf level', () => {
    const data: SolutionData = {
      pieceOrder: ['A', 'B', 'C'],
      placements: [
        ['a', 'b', 'c1'],
        ['a', 'b', 'c2'],
        ['a', 'b', 'c3'],
      ],
    }

    const root = buildSolutionTrie(data)
    const ids = collectLeafSolutionIds(root).sort()
    expect(ids).toEqual([0, 1, 2])
  })

  it('should set solutionCount correctly at each level', () => {
    const data: SolutionData = {
      pieceOrder: ['A', 'B'],
      placements: [
        ['a1', 'b1'],
        ['a1', 'b2'],
        ['a2', 'b3'],
      ],
    }

    const root = buildSolutionTrie(data)
    expect(root.solutionCount).toBe(3)

    const a1 = root.children.find(c => c.placementKey === 'a1')!
    expect(a1.solutionCount).toBe(2)

    const a2 = root.children.find(c => c.placementKey === 'a2')!
    expect(a2.solutionCount).toBe(1)
  })

  it('should handle empty placements', () => {
    const data: SolutionData = {
      pieceOrder: ['A'],
      placements: [],
    }

    const root = buildSolutionTrie(data)
    expect(root.children).toHaveLength(0)
    expect(root.solutionCount).toBe(0)
  })
})
