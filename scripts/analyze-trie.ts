#!/usr/bin/env npx tsx
/**
 * 解法データのトライ圧縮分析スクリプト
 *
 * 全ピース順序のヒューリスティック探索を行い、最適な順序を報告する。
 * 各パズルの解法 JSON を読み込み、ピースベースの配置表現に変換した上で
 * トライを構築してノード数を計測する。
 *
 * Usage: npx tsx scripts/analyze-trie.ts [puzzleId]
 */

import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const solutionsDir = resolve(__dirname, '..', 'public', 'solutions')

// -------------------------------------------------------------------
// 型定義
// -------------------------------------------------------------------

/** 1つの解法をピースベースで表現: pieceId -> その配置のキー文字列 */
type PiecePlacement = Map<string, string>

/** トライノード */
type TrieNode = {
  children: Map<string, TrieNode>
  /** このノードで終端する解の数 */
  terminalCount: number
}

// -------------------------------------------------------------------
// 解法データの読み込みとピースベース変換
// -------------------------------------------------------------------

/**
 * セルベースの解法 ([cellKey, pieceId][]) を
 * ピースベース (pieceId -> ソート済みセルキー列) に変換
 */
function toPieceBased(solution: [string, string][]): PiecePlacement {
  const map = new Map<string, string[]>()
  for (const [cellKey, pieceId] of solution) {
    let cells = map.get(pieceId)
    if (!cells) {
      cells = []
      map.set(pieceId, cells)
    }
    cells.push(cellKey)
  }
  // 各ピースのセルをソートして結合 → 配置キー
  const result = new Map<string, string>()
  for (const [pieceId, cells] of map) {
    result.set(pieceId, cells.sort().join(';'))
  }
  return result
}

function loadSolutions(puzzleId: string): { pieceIds: string[]; placements: PiecePlacement[] } {
  const filePath = resolve(solutionsDir, `${puzzleId}.json`)
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as {
    count: number
    solutions: [string, string][][]
  }

  const placements = raw.solutions.map(toPieceBased)
  // ピースIDの集合（全解から収集）
  const pieceIdSet = new Set<string>()
  for (const p of placements) {
    for (const id of p.keys()) {
      pieceIdSet.add(id)
    }
  }
  const pieceIds = [...pieceIdSet].sort()

  return { pieceIds, placements }
}

// -------------------------------------------------------------------
// トライ構築
// -------------------------------------------------------------------

function newTrieNode(): TrieNode {
  return { children: new Map(), terminalCount: 0 }
}

function buildTrie(placements: PiecePlacement[], pieceOrder: string[]): TrieNode {
  const root = newTrieNode()

  for (const placement of placements) {
    let node = root
    for (const pieceId of pieceOrder) {
      const key = placement.get(pieceId) ?? ''
      let child = node.children.get(key)
      if (!child) {
        child = newTrieNode()
        node.children.set(key, child)
      }
      node = child
    }
    node.terminalCount++
  }

  return root
}

function countNodes(node: TrieNode): number {
  let count = 1 // このノード自身
  for (const child of node.children.values()) {
    count += countNodes(child)
  }
  return count
}

/** 各レベルの分岐ファクタ（平均と最大）を収集 */
function branchingFactors(root: TrieNode, depth: number): { level: number; avg: number; max: number; nodeCount: number }[] {
  const result: { level: number; avg: number; max: number; nodeCount: number }[] = []
  let currentLevel: TrieNode[] = [root]

  for (let level = 0; level < depth; level++) {
    let totalBranches = 0
    let maxBranches = 0
    const nextLevel: TrieNode[] = []

    for (const node of currentLevel) {
      const b = node.children.size
      totalBranches += b
      if (b > maxBranches) maxBranches = b
      for (const child of node.children.values()) {
        nextLevel.push(child)
      }
    }

    result.push({
      level,
      avg: currentLevel.length > 0 ? totalBranches / currentLevel.length : 0,
      max: maxBranches,
      nodeCount: currentLevel.length,
    })

    currentLevel = nextLevel
  }

  return result
}

// -------------------------------------------------------------------
// 最適化ヒューリスティクス
// -------------------------------------------------------------------

/**
 * 各ピースのユニーク配置数（全解における）を計算
 */
function uniquePlacementCounts(placements: PiecePlacement[], pieceIds: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const pieceId of pieceIds) {
    const seen = new Set<string>()
    for (const p of placements) {
      const key = p.get(pieceId)
      if (key) seen.add(key)
    }
    counts.set(pieceId, seen.size)
  }
  return counts
}

/**
 * ヒューリスティック1: ユニーク配置数の昇順（配置バリエーションが少ないものを先に）
 */
function orderByUniquePlacements(placements: PiecePlacement[], pieceIds: string[]): string[] {
  const counts = uniquePlacementCounts(placements, pieceIds)
  return [...pieceIds].sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0))
}

/**
 * ヒューリスティック2: 貪欲法
 * 各レベルで「そのレベルでの合計分岐（= 新規ノード数）が最小になるピース」を選ぶ
 */
function orderByGreedy(placements: PiecePlacement[], pieceIds: string[]): string[] {
  const order: string[] = []
  const remaining = new Set(pieceIds)

  // 各解法を「これまでのパス」で分類
  // パスキー -> その配下の解法インデックス群
  let groups: Map<string, number[]> = new Map([['', placements.map((_, i) => i)]])

  for (let level = 0; level < pieceIds.length; level++) {
    let bestPiece = ''
    let bestCost = Infinity

    for (const candidate of remaining) {
      // このピースを追加した場合の分岐数（= 新規ノード数）を計算
      let cost = 0
      for (const [, indices] of groups) {
        const seen = new Set<string>()
        for (const i of indices) {
          seen.add(placements[i].get(candidate) ?? '')
        }
        cost += seen.size
      }
      if (cost < bestCost) {
        bestCost = cost
        bestPiece = candidate
      }
    }

    order.push(bestPiece)
    remaining.delete(bestPiece)

    // グループを分割
    const newGroups = new Map<string, number[]>()
    for (const [pathKey, indices] of groups) {
      for (const i of indices) {
        const placementKey = placements[i].get(bestPiece) ?? ''
        const newPath = pathKey + '|' + placementKey
        let group = newGroups.get(newPath)
        if (!group) {
          group = []
          newGroups.set(newPath, group)
        }
        group.push(i)
      }
    }
    groups = newGroups
  }

  return order
}

/**
 * ヒューリスティック3: 逆貪欲法（最終レベルから逆順に配置バリエーションの多いものを選ぶ）
 */
function orderByReverseGreedy(placements: PiecePlacement[], pieceIds: string[]): string[] {
  // 逆から構築: 「最後のレベルで分岐が最大になるピース」を末尾に置く
  // = 序盤のレベルが共有されやすくなる
  const remaining = new Set(pieceIds)
  const reverseOrder: string[] = []

  for (let level = pieceIds.length - 1; level >= 0; level--) {
    // 残りのピースの中で、ユニーク配置数が最大のものを選ぶ
    let worstPiece = ''
    let worstCount = -1

    for (const candidate of remaining) {
      const seen = new Set<string>()
      for (const p of placements) {
        seen.add(p.get(candidate) ?? '')
      }
      if (seen.size > worstCount) {
        worstCount = seen.size
        worstPiece = candidate
      }
    }

    reverseOrder.push(worstPiece)
    remaining.delete(worstPiece)
  }

  return reverseOrder.reverse()
}

/**
 * ヒューリスティック4: ランダムサンプリング — N個のランダム順列を試して最良を選ぶ
 */
function orderByRandomSampling(
  placements: PiecePlacement[],
  pieceIds: string[],
  numSamples: number,
): { order: string[]; nodeCount: number } {
  let bestOrder = pieceIds
  let bestNodes = Infinity

  for (let i = 0; i < numSamples; i++) {
    const shuffled = [...pieceIds]
    // Fisher-Yates shuffle
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1))
      ;[shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]
    }
    const trie = buildTrie(placements, shuffled)
    const nodes = countNodes(trie)
    if (nodes < bestNodes) {
      bestNodes = nodes
      bestOrder = shuffled
    }
  }

  return { order: bestOrder, nodeCount: bestNodes }
}

/**
 * ヒューリスティック5: 改良版貪欲法 — UI体験を考慮
 * 序盤のレベルで適度な分岐（2〜8）を目指す
 */
function orderByBalancedGreedy(placements: PiecePlacement[], pieceIds: string[]): string[] {
  const order: string[] = []
  const remaining = new Set(pieceIds)

  let groups: Map<string, number[]> = new Map([['', placements.map((_, i) => i)]])

  for (let level = 0; level < pieceIds.length; level++) {
    let bestPiece = ''
    let bestScore = Infinity

    // 目標分岐数: 序盤はやや多め(UIで選択肢を見せたい)、後半は少なく
    const idealBranching = level < 3 ? 6 : level < 6 ? 4 : 2

    for (const candidate of remaining) {
      let totalNodes = 0
      let branchingPenalty = 0

      for (const [, indices] of groups) {
        const seen = new Set<string>()
        for (const i of indices) {
          seen.add(placements[i].get(candidate) ?? '')
        }
        totalNodes += seen.size
        // 分岐数が目標から離れるほどペナルティ
        const diff = Math.abs(seen.size - idealBranching)
        branchingPenalty += diff
      }

      // ノード数 + 分岐バランスペナルティ
      const score = totalNodes + branchingPenalty * 0.5
      if (score < bestScore) {
        bestScore = score
        bestPiece = candidate
      }
    }

    order.push(bestPiece)
    remaining.delete(bestPiece)

    const newGroups = new Map<string, number[]>()
    for (const [pathKey, indices] of groups) {
      for (const i of indices) {
        const placementKey = placements[i].get(bestPiece) ?? ''
        const newPath = pathKey + '|' + placementKey
        let group = newGroups.get(newPath)
        if (!group) {
          group = []
          newGroups.set(newPath, group)
        }
        group.push(i)
      }
    }
    groups = newGroups
  }

  return order
}

// -------------------------------------------------------------------
// レポート出力
// -------------------------------------------------------------------

function analyzeAndReport(puzzleId: string) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`Puzzle: ${puzzleId}`)
  console.log(`${'='.repeat(70)}`)

  const { pieceIds, placements } = loadSolutions(puzzleId)
  const numSolutions = placements.length
  const numPieces = pieceIds.length

  console.log(`  Solutions: ${numSolutions}`)
  console.log(`  Pieces: ${numPieces} (${pieceIds.join(', ')})`)

  // ナイーブベースライン: ピース数 × 解数
  const naiveNodes = numPieces * numSolutions
  console.log(`  Naive (flat): ${naiveNodes} nodes (${numPieces} x ${numSolutions})`)

  // 各ピースのユニーク配置数
  const uniqueCounts = uniquePlacementCounts(placements, pieceIds)
  console.log(`\n  Unique placements per piece:`)
  const sortedByCount = [...uniqueCounts.entries()].sort((a, b) => a[1] - b[1])
  for (const [id, count] of sortedByCount) {
    console.log(`    ${id}: ${count}`)
  }

  // 各ヒューリスティックを試す
  const strategies: { name: string; order: string[] }[] = [
    { name: 'Definition order', order: pieceIds },
    { name: 'Unique placements ASC', order: orderByUniquePlacements(placements, pieceIds) },
    { name: 'Greedy (min new nodes)', order: orderByGreedy(placements, pieceIds) },
    { name: 'Reverse greedy', order: orderByReverseGreedy(placements, pieceIds) },
    { name: 'Balanced greedy (UI-aware)', order: orderByBalancedGreedy(placements, pieceIds) },
  ]

  // ランダムサンプリング
  console.log(`\n  Running random sampling (1000 permutations)...`)
  const randomResult = orderByRandomSampling(placements, pieceIds, 1000)
  strategies.push({ name: 'Random best (1000 samples)', order: randomResult.order })

  console.log(`\n  ${'─'.repeat(66)}`)
  console.log(`  ${'Strategy'.padEnd(35)} ${'Order'.padEnd(25)} Nodes    Ratio`)
  console.log(`  ${'─'.repeat(66)}`)

  let bestStrategy = ''
  let bestNodes = Infinity
  let bestOrder: string[] = []
  let bestBranching: ReturnType<typeof branchingFactors> = []

  for (const { name, order } of strategies) {
    const trie = buildTrie(placements, order)
    const nodes = countNodes(trie)
    const ratio = (nodes / naiveNodes * 100).toFixed(1)
    const orderStr = order.join(',')
    console.log(`  ${name.padEnd(35)} ${orderStr.padEnd(25)} ${String(nodes).padStart(7)}  ${ratio.padStart(5)}%`)

    if (nodes < bestNodes) {
      bestNodes = nodes
      bestStrategy = name
      bestOrder = order
      bestBranching = branchingFactors(trie, numPieces)
    }
  }

  console.log(`  ${'─'.repeat(66)}`)
  console.log(`\n  Best: ${bestStrategy}`)
  console.log(`  Order: [${bestOrder.map(id => `'${id}'`).join(', ')}]`)
  console.log(`  Nodes: ${bestNodes} (vs naive ${naiveNodes}, ${(bestNodes / naiveNodes * 100).toFixed(1)}%)`)
  console.log(`  Compression: ${naiveNodes} -> ${bestNodes} = ${((1 - bestNodes / naiveNodes) * 100).toFixed(1)}% reduction`)

  // 分岐ファクタの詳細
  console.log(`\n  Branching factors (best order):`)
  console.log(`  ${'Level'.padStart(7)} ${'Piece'.padStart(6)} ${'Nodes'.padStart(8)} ${'Avg Branch'.padStart(12)} ${'Max Branch'.padStart(12)}`)
  for (const bf of bestBranching) {
    const pieceId = bestOrder[bf.level] ?? '-'
    console.log(
      `  ${String(bf.level).padStart(7)} ${pieceId.padStart(6)} ${String(bf.nodeCount).padStart(8)} ${bf.avg.toFixed(2).padStart(12)} ${String(bf.max).padStart(12)}`
    )
  }

  // トライの累積ノード数（レベルごと）
  const trie = buildTrie(placements, bestOrder)
  console.log(`\n  Cumulative nodes by level:`)
  let cumulative = 1 // root
  let currentLevel: TrieNode[] = [trie]
  for (let level = 0; level < numPieces; level++) {
    const nextLevel: TrieNode[] = []
    for (const node of currentLevel) {
      for (const child of node.children.values()) {
        nextLevel.push(child)
      }
    }
    cumulative += nextLevel.length
    const pieceId = bestOrder[level]
    console.log(`    Level ${level} (${pieceId}): +${nextLevel.length} nodes = ${cumulative} total`)
    currentLevel = nextLevel
  }

  // バイト数推定
  // 各ノード: 配置キー（可変長）+ 子ポインタ
  // 簡易推定: 各ノードを固定サイズとして計算
  const estimatedBytesPerNode = 16 // ノードID(4) + 配置データ(8) + 子配列ポインタ(4)
  const trieBytes = bestNodes * estimatedBytesPerNode
  const naiveBytes = numSolutions * numPieces * 12 // orientation(1) + row(1) + col(1) + pieceId(1) + padding
  console.log(`\n  Estimated size:`)
  console.log(`    Trie: ~${(trieBytes / 1024).toFixed(1)} KB (${bestNodes} nodes x ${estimatedBytesPerNode} bytes)`)
  console.log(`    Naive: ~${(naiveBytes / 1024).toFixed(1)} KB (${numSolutions} solutions x ${numPieces} pieces x 12 bytes)`)

  // UI ドリルダウン分析
  console.log(`\n  UI drilldown experience (best order):`)
  console.log(`  User navigates by selecting a piece placement at each level.`)
  console.log(`  Ideal: 2-8 choices at each level (too many = overwhelming, 1 = no choice).`)
  currentLevel = [trie]
  for (let level = 0; level < numPieces; level++) {
    const branchCounts: number[] = []
    const nextLevel: TrieNode[] = []
    for (const node of currentLevel) {
      branchCounts.push(node.children.size)
      for (const child of node.children.values()) {
        nextLevel.push(child)
      }
    }
    const avgBranch = branchCounts.reduce((a, b) => a + b, 0) / branchCounts.length
    const maxBranch = Math.max(...branchCounts)
    const minBranch = Math.min(...branchCounts)
    const oneBranchPct = (branchCounts.filter(b => b === 1).length / branchCounts.length * 100).toFixed(0)
    const pieceId = bestOrder[level]
    console.log(
      `    Level ${level} (${pieceId}): ` +
      `${branchCounts.length} nodes, ` +
      `branch ${minBranch}-${maxBranch} (avg ${avgBranch.toFixed(1)}), ` +
      `${oneBranchPct}% have only 1 choice`
    )
    currentLevel = nextLevel
  }

  // 内部ノード数（リーフを除く）— 実際の圧縮効果
  const internalNodes = bestNodes - numSolutions
  const naiveInternal = naiveNodes - numSolutions
  console.log(`\n  Internal nodes (excl. leaves): ${internalNodes} (vs naive ${naiveInternal}, ${(internalNodes / naiveInternal * 100).toFixed(1)}%)`)
  console.log(`  Leaf nodes: ${numSolutions} (always equal to solution count)`)

  return { bestOrder, bestNodes, naiveNodes, bestStrategy }
}

// -------------------------------------------------------------------
// メイン
// -------------------------------------------------------------------

const targetPuzzle = process.argv[2]

if (targetPuzzle) {
  analyzeAndReport(targetPuzzle)
} else {
  // 全パズルを分析
  const files = readdirSync(solutionsDir).filter(f => f.endsWith('.json'))
  const results: { puzzleId: string; bestOrder: string[]; bestNodes: number; naiveNodes: number; bestStrategy: string }[] = []

  for (const file of files) {
    const puzzleId = basename(file, '.json')
    const result = analyzeAndReport(puzzleId)
    results.push({ puzzleId, ...result })
  }

  // サマリー
  console.log(`\n\n${'='.repeat(70)}`)
  console.log('SUMMARY')
  console.log(`${'='.repeat(70)}`)
  console.log(`${'Puzzle'.padEnd(25)} ${'Solutions'.padStart(10)} ${'Naive'.padStart(10)} ${'Trie'.padStart(10)} ${'Reduction'.padStart(12)} Strategy`)
  console.log(`${'─'.repeat(90)}`)
  for (const r of results) {
    const reduction = ((1 - r.bestNodes / r.naiveNodes) * 100).toFixed(1)
    console.log(
      `${r.puzzleId.padEnd(25)} ${String(r.naiveNodes / (r.bestOrder.length || 1)).padStart(10)} ${String(r.naiveNodes).padStart(10)} ${String(r.bestNodes).padStart(10)} ${(reduction + '%').padStart(12)} ${r.bestStrategy}`
    )
  }
}
