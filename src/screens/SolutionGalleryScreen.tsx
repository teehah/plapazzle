import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { GRID_OPS } from '../core/grid-ops'
import { PUZZLES } from '../data/puzzles'
import { svgPointsBbox } from '../game/bbox'
import { loadSolutions, type SolutionData } from '../game/solution-loader'
import { buildSolutionTrie, type TrieNode } from '../game/solution-trie'

type Props = {
  puzzleId: string
  discoveredIds: number[]
  onBack: () => void
}

const PIECE_PALETTE = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
  '#e91e63', '#00bcd4', '#8bc34a', '#ff5722',
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
  '#ffeaa7', '#a29bfe', '#fd79a8', '#636e72',
]

/**
 * placement key ("r0,c0,d0;r1,c1,d1;...") をパースして Cell[] を返す。
 */
function parsePlacementKey(key: string): Cell[] {
  return key.split(';').map(part => {
    const [r, c, d] = part.split(',').map(Number)
    return { row: r, col: c, dir: d as 0 | 1 }
  })
}

/**
 * ボードプレビュー SVG。
 * placements は配置済みピースの情報（pieceIndex + cells）。
 * 配置されていないセルは灰色で表示。
 */
function SolutionPreview({
  board,
  gridType,
  placements,
  discovered,
}: {
  board: Cell[]
  gridType: GridType
  placements: { pieceIndex: number; cells: Cell[] }[]
  discovered: boolean
}) {
  const ops = GRID_OPS[gridType]
  const cellSize = 10

  // ボード全体の SVG パスを計算
  const allPoints: [number, number][] = []
  const boardPaths: string[] = []
  for (const cell of board) {
    const pts = ops.cellToSvgPoints(cell, cellSize)
    boardPaths.push('M ' + pts.map(([x, y]) => `${x},${y}`).join(' L ') + ' Z')
    for (const pt of pts) allPoints.push(pt)
  }

  // ピースごとの SVG パスを計算
  const piecePaths: { path: string; color: string }[] = []
  if (discovered) {
    for (const p of placements) {
      const color = PIECE_PALETTE[p.pieceIndex % PIECE_PALETTE.length]
      const cellPaths: string[] = []
      for (const cell of p.cells) {
        const pts = ops.cellToSvgPoints(cell, cellSize)
        cellPaths.push('M ' + pts.map(([x, y]) => `${x},${y}`).join(' L ') + ' Z')
        for (const pt of pts) allPoints.push(pt)
      }
      piecePaths.push({ path: cellPaths.join(' '), color })
    }
  }

  const { minX, maxX, minY, maxY } = svgPointsBbox(allPoints)
  const pad = 2
  const w = maxX - minX + pad * 2
  const h = maxY - minY + pad * 2

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${w} ${h}`}
      style={{ width: '100%', height: '100%' }}
    >
      {/* ボード背景 */}
      <path
        d={boardPaths.join(' ')}
        fill={discovered ? 'rgba(52,73,94,0.08)' : 'rgba(52,73,94,0.15)'}
        stroke="rgba(52,73,94,0.15)"
        strokeWidth={0.3}
      />
      {/* ピース */}
      {discovered ? (
        piecePaths.map((p, i) => (
          <path
            key={i}
            d={p.path}
            fill={p.color}
            fillOpacity={0.7}
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={0.3}
          />
        ))
      ) : (
        /* 未発見: ロックアイコン表示 */
        <text
          x={(minX + maxX) / 2}
          y={(minY + maxY) / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min(w, h) * 0.35}
          fill="rgba(52,73,94,0.25)"
        >
          ?
        </text>
      )}
    </svg>
  )
}

/**
 * ドリルダウンパスに基づく解法プレビューの配置情報を構築する。
 */
function buildPlacements(
  path: TrieNode[],
  pieceOrder: string[],
  puzzlePieces: { id: string }[],
): { pieceIndex: number; cells: Cell[] }[] {
  const result: { pieceIndex: number; cells: Cell[] }[] = []
  // path[0] は root（placementKey = ''）なのでスキップ
  for (let i = 1; i < path.length; i++) {
    const node = path[i]
    const pieceId = pieceOrder[i - 1]
    const pieceIndex = puzzlePieces.findIndex(p => p.id === pieceId)
    if (pieceIndex >= 0 && node.placementKey) {
      result.push({
        pieceIndex,
        cells: parsePlacementKey(node.placementKey),
      })
    }
  }
  return result
}

/**
 * 子ノードのプレビュー用配置情報を構築する。
 * 親までの配置 + この子のピース配置を含む。
 */
function buildChildPlacements(
  parentPath: TrieNode[],
  child: TrieNode,
  pieceOrder: string[],
  puzzlePieces: { id: string }[],
): { pieceIndex: number; cells: Cell[] }[] {
  const parentPlacements = buildPlacements(parentPath, pieceOrder, puzzlePieces)
  const level = parentPath.length - 1 // root を除いた深さ
  const pieceId = pieceOrder[level]
  const pieceIndex = puzzlePieces.findIndex(p => p.id === pieceId)
  if (pieceIndex >= 0 && child.placementKey) {
    return [
      ...parentPlacements,
      { pieceIndex, cells: parsePlacementKey(child.placementKey) },
    ]
  }
  return parentPlacements
}

/**
 * ノードが保持する全 solutionIds のうち、発見済みのものがあるかチェック
 */
function hasDiscoveredSolution(node: TrieNode, discoveredSet: Set<number>): boolean {
  if (node.solutionIds.length > 0) {
    for (const id of node.solutionIds) {
      if (discoveredSet.has(id)) return true
    }
  }
  for (const child of node.children) {
    if (hasDiscoveredSolution(child, discoveredSet)) return true
  }
  return false
}

/**
 * ノード配下の発見済み解法数をカウント
 */
function countDiscovered(node: TrieNode, discoveredSet: Set<number>): number {
  let count = 0
  if (node.solutionIds.length > 0) {
    for (const id of node.solutionIds) {
      if (discoveredSet.has(id)) count++
    }
  }
  for (const child of node.children) {
    count += countDiscovered(child, discoveredSet)
  }
  return count
}

/**
 * リーフかどうかの判定
 */
function isLeaf(node: TrieNode): boolean {
  return node.children.length === 0
}

export function SolutionGalleryScreen({ puzzleId, discoveredIds, onBack }: Props) {
  const [data, setData] = useState<SolutionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // ドリルダウンパス: [root, level0選択, level1選択, ...]
  const [path, setPath] = useState<TrieNode[]>([])

  const puzzle = useMemo(() => PUZZLES.find(p => p.id === puzzleId), [puzzleId])
  const discoveredSet = useMemo(() => new Set(discoveredIds), [discoveredIds])

  // 解法データのロード
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadSolutions(puzzleId)
      .then(d => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [puzzleId])

  // トライ構築
  const trie = useMemo(() => data ? buildSolutionTrie(data) : null, [data])

  // トライが変わったらパスをリセット
  useEffect(() => {
    if (trie) setPath([trie])
  }, [trie])

  const handleDrillDown = useCallback((child: TrieNode) => {
    setPath(prev => [...prev, child])
  }, [])

  const handleBack = useCallback(() => {
    setPath(prev => {
      if (prev.length > 1) return prev.slice(0, -1)
      return prev
    })
  }, [])

  if (!puzzle) {
    return (
      <div style={{ minHeight: '100dvh', background: 'linear-gradient(135deg, #e8e0d8, #d4c8be)', padding: 24 }}>
        <button onClick={onBack} style={backButtonStyle}>← 戻る</button>
        <div style={{ color: 'rgba(0,0,0,0.35)', textAlign: 'center', marginTop: 60 }}>
          パズルが見つかりません
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'linear-gradient(135deg, #e8e0d8, #d4c8be)', padding: 24 }}>
        <button onClick={onBack} style={backButtonStyle}>← 戻る</button>
        <div style={{ color: 'rgba(0,0,0,0.35)', textAlign: 'center', marginTop: 60 }}>
          読み込み中...
        </div>
      </div>
    )
  }

  if (error || !data || !trie || path.length === 0) {
    return (
      <div style={{ minHeight: '100dvh', background: 'linear-gradient(135deg, #e8e0d8, #d4c8be)', padding: 24 }}>
        <button onClick={onBack} style={backButtonStyle}>← 戻る</button>
        <div style={{ color: 'rgba(0,0,0,0.35)', textAlign: 'center', marginTop: 60 }}>
          {error ?? '解法データの読み込みに失敗しました'}
        </div>
      </div>
    )
  }

  const currentNode = path[path.length - 1]
  const depth = path.length - 1 // root除いた深さ
  const totalSolutions = trie.solutionCount

  // リーフ到達
  if (isLeaf(currentNode)) {
    const solutionId = currentNode.solutionIds[0]
    const discovered = solutionId !== undefined && discoveredSet.has(solutionId)
    const placements = buildPlacements(path, data.pieceOrder, puzzle.pieces)

    return (
      <div style={{
        minHeight: '100dvh', background: 'linear-gradient(135deg, #e8e0d8, #d4c8be)',
        padding: 24, fontFamily: 'sans-serif',
      }}>
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <button onClick={handleBack} style={backButtonStyle}>← 戻る</button>
          <h2 style={{ color: '#34495e', fontSize: 16, marginLeft: 16, margin: '0 0 0 16px' }}>
            解法 #{solutionId !== undefined ? solutionId + 1 : '?'}
          </h2>
        </div>

        {/* パスのパンくず */}
        <BreadcrumbPath path={path} pieceOrder={data.pieceOrder} onNavigate={setPath} />

        {/* 拡大プレビュー */}
        <div style={{
          maxWidth: 400, margin: '24px auto',
          background: 'rgba(255,255,255,0.6)', borderRadius: 16,
          padding: 24, border: '1px solid rgba(52,73,94,0.12)',
        }}>
          <SolutionPreview
            board={puzzle.board}
            gridType={puzzle.gridType}
            placements={placements}
            discovered={discovered}
          />
        </div>

        {discovered ? (
          <div style={{ textAlign: 'center', color: '#34495e', fontSize: 14 }}>
            発見済み
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.35)', fontSize: 14 }}>
            未発見
          </div>
        )}
      </div>
    )
  }

  // ドリルダウンUI
  const children = currentNode.children
  const pieceIdAtLevel = depth < data.pieceOrder.length ? data.pieceOrder[depth] : null
  const discoveredCount = countDiscovered(currentNode, discoveredSet)

  return (
    <div style={{
      minHeight: '100dvh', background: 'linear-gradient(135deg, #e8e0d8, #d4c8be)',
      padding: 24, fontFamily: 'sans-serif',
    }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <button
          onClick={depth === 0 ? onBack : handleBack}
          style={backButtonStyle}
        >
          ← 戻る
        </button>
        <h2 style={{ color: '#34495e', fontSize: 16, margin: '0 0 0 16px' }}>
          解法一覧 ({totalSolutions}解)
        </h2>
      </div>

      {/* パスのパンくず */}
      <BreadcrumbPath path={path} pieceOrder={data.pieceOrder} onNavigate={setPath} />

      {/* レベル情報 */}
      <div style={{
        fontSize: 12, color: 'rgba(0,0,0,0.45)', marginBottom: 16,
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
      }}>
        {pieceIdAtLevel && (
          <span>
            ピース: <strong style={{ color: '#34495e' }}>{pieceIdAtLevel}</strong>
          </span>
        )}
        <span>{currentNode.solutionCount}解</span>
        <span>{children.length}分岐</span>
        <span>{discoveredCount}件発見済み</span>
      </div>

      {/* カードグリッド */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 12,
        maxWidth: 800,
        margin: '0 auto',
      }}>
        {children.map((child, idx) => {
          const childDiscovered = hasDiscoveredSolution(child, discoveredSet)
          const childPlacements = buildChildPlacements(path, child, data.pieceOrder, puzzle.pieces)
          const childDiscoveredCount = countDiscovered(child, discoveredSet)

          return (
            <div
              key={idx}
              onClick={() => handleDrillDown(child)}
              style={{
                background: childDiscovered ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
                border: childDiscovered
                  ? '1px solid rgba(52,73,94,0.2)'
                  : '1px solid rgba(52,73,94,0.08)',
                borderRadius: 12,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.1s',
              }}
            >
              {/* サムネイル */}
              <div style={{
                aspectRatio: '1',
                padding: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <SolutionPreview
                  board={puzzle.board}
                  gridType={puzzle.gridType}
                  placements={childPlacements}
                  discovered={childDiscovered}
                />
              </div>

              {/* 情報 */}
              <div style={{
                padding: '4px 8px 8px',
                fontSize: 11,
                color: childDiscovered ? 'rgba(52,73,94,0.7)' : 'rgba(0,0,0,0.3)',
                textAlign: 'center',
              }}>
                {isLeaf(child) ? (
                  <span>{childDiscovered ? '発見済み' : '未発見'}</span>
                ) : (
                  <span>
                    {child.solutionCount}解
                    {childDiscoveredCount > 0 && ` (${childDiscoveredCount}件発見)`}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * パンくずリストコンポーネント
 */
function BreadcrumbPath({
  path,
  pieceOrder,
  onNavigate,
}: {
  path: TrieNode[]
  pieceOrder: string[]
  onNavigate: (path: TrieNode[]) => void
}) {
  if (path.length <= 1) return null

  return (
    <div style={{
      fontSize: 11, color: 'rgba(0,0,0,0.4)', marginBottom: 12,
      display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
    }}>
      <span
        onClick={() => onNavigate([path[0]])}
        style={{ cursor: 'pointer', color: 'rgba(52,73,94,0.6)' }}
      >
        全解法
      </span>
      {path.slice(1).map((_node, i) => {
        const pieceId = pieceOrder[i]
        const isLast = i === path.length - 2
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'rgba(0,0,0,0.2)' }}>/</span>
            <span
              onClick={() => { if (!isLast) onNavigate(path.slice(0, i + 2)) }}
              style={{
                cursor: isLast ? 'default' : 'pointer',
                color: isLast ? 'rgba(0,0,0,0.5)' : 'rgba(52,73,94,0.6)',
              }}
            >
              {pieceId}
            </span>
          </span>
        )
      })}
    </div>
  )
}

const backButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'rgba(52,73,94,0.7)',
  fontSize: 14,
  cursor: 'pointer',
  padding: 0,
}
