import { useRef, useCallback } from 'react'
import type { PuzzleDef } from '../core/puzzle'
import type { PuzzleRecord } from '../storage/db'
import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { GRID_OPS } from '../core/grid-ops'
import { svgPointsBbox } from '../game/bbox'
import { formatTime } from '../utils/format'

type Props = {
  puzzles: PuzzleDef[]
  records: Map<string, PuzzleRecord>
  onSelect: (puzzleId: string) => void
  onGallery: (puzzleId: string) => void
}

const GRID_LABELS: Record<string, string> = {
  triangular: '三角',
  square: '正方形',
  hexagonal: '六角',
}

function boardSizeLabel(board: { row: number; col: number }[]): string {
  const rows = Math.max(...board.map(c => c.row)) + 1
  const cols = Math.max(...board.map(c => c.col)) + 1
  return `${rows}×${cols}`
}

/** ボード形状の SVG プレビューを生成 */
function BoardPreview({ board, gridType }: { board: Cell[]; gridType: GridType }) {
  const ops = GRID_OPS[gridType]
  const cellSize = 10
  const paths: string[] = []

  const allPoints: [number, number][] = []
  for (const cell of board) {
    const pts = ops.cellToSvgPoints(cell, cellSize)
    paths.push('M ' + pts.map(([x, y]) => `${x},${y}`).join(' L ') + ' Z')
    for (const pt of pts) allPoints.push(pt)
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
      <path
        d={paths.join(' ')}
        fill="rgba(52,73,94,0.15)"
        stroke="rgba(52,73,94,0.3)"
        strokeWidth={0.5}
      />
    </svg>
  )
}

export function PuzzleSelectScreen({ puzzles, records, onSelect, onGallery }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({ dragging: false, startX: 0, scrollLeft: 0, moved: false, targetId: '', noCardTap: false })

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const el = scrollRef.current
    if (!el) return
    const target = e.target as HTMLElement
    // タップ対象のパズルIDを取得
    const card = target.closest<HTMLElement>('[data-puzzle-id]')
    const targetId = card?.dataset.puzzleId ?? ''
    const noCardTap = !!target.closest('[data-no-card-tap]')
    dragState.current = { dragging: true, startX: e.clientX, scrollLeft: el.scrollLeft, moved: false, targetId, noCardTap }
    el.setPointerCapture(e.pointerId)
    el.style.scrollSnapType = 'none'
    el.style.cursor = 'grabbing'
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.dragging) return
    const dx = e.clientX - dragState.current.startX
    if (Math.abs(dx) > 5) dragState.current.moved = true
    scrollRef.current!.scrollLeft = dragState.current.scrollLeft - dx
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.dragging) return
    const { moved, targetId } = dragState.current
    dragState.current.dragging = false
    const el = scrollRef.current!
    el.releasePointerCapture(e.pointerId)
    el.style.scrollSnapType = 'x mandatory'
    el.style.cursor = ''

    // タップ（ドラッグなし）
    if (!moved && targetId) {
      if (dragState.current.noCardTap) {
        onGallery(targetId)
      } else {
        onSelect(targetId)
      }
    }
  }, [onSelect, onGallery])

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(135deg, #e8e0d8, #d4c8be)',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      fontFamily: 'sans-serif',
    }}>
      <h1 style={{ textAlign: 'center', color: '#34495e', fontSize: 18, margin: '24px 0 16px' }}>パズルを選ぶ</h1>

      {/* 横スクロール カルーセル（ドラッグ/スワイプ対応） */}
      <div
        ref={scrollRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          display: 'flex', gap: 16, overflowX: 'auto',
          padding: '16px 24px',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        {puzzles.map(puzzle => {
          const record = records.get(puzzle.id) ?? { bestTimeMs: null, discoveredSolutionIds: [], totalClears: 0 }
          const cleared = record.totalClears > 0
          return (
            <div
              key={puzzle.id}
              data-puzzle-id={puzzle.id}
              style={{
                flex: '0 0 280px',
                scrollSnapAlign: 'center',
                background: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(52,73,94,0.12)',
                borderRadius: 16,
                overflow: 'hidden',
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              }}
            >
              {/* ボードプレビュー */}
              <div style={{
                height: 160,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16,
                background: 'rgba(52,73,94,0.03)',
              }}>
                <BoardPreview board={puzzle.board} gridType={puzzle.gridType} />
              </div>

              {/* 情報 */}
              <div style={{ padding: '12px 16px 16px' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#34495e' }}>{puzzle.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', marginTop: 4 }}>
                  {GRID_LABELS[puzzle.gridType] ?? puzzle.gridType} · {boardSizeLabel(puzzle.board)} · {puzzle.pieces.length} ピース
                </div>
                <div style={{
                  marginTop: 8, display: 'flex', gap: 12,
                  fontSize: 11, color: 'rgba(0,0,0,0.4)',
                }}>
                  <span>ベスト: {record.bestTimeMs !== null ? formatTime(record.bestTimeMs) : '-'}</span>
                  <span>{record.discoveredSolutionIds.length} 解発見</span>
                  {cleared && (
                    <span
                      data-no-card-tap
                      onClick={e => { e.stopPropagation(); onGallery(puzzle.id) }}
                      style={{ color: 'rgba(52,73,94,0.7)', cursor: 'pointer', marginLeft: 'auto' }}
                    >
                      解法一覧 →
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
