import type { PuzzleDef } from '../core/puzzle'

export type PuzzleRecord = {
  bestTimeMs: number | null
  discoveredSolutionIds: number[]
  totalClears: number
}

type Props = {
  puzzles: PuzzleDef[]
  records: Map<string, PuzzleRecord>
  onSelect: (puzzleId: string) => void
  onGallery: (puzzleId: string) => void
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export function PuzzleSelectScreen({ puzzles, records, onSelect, onGallery }: Props) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(135deg, #0d1117, #1a1a2e)',
      padding: 24, fontFamily: 'sans-serif',
    }}>
      <h1 style={{ textAlign: 'center', color: '#fff', fontSize: 18, marginBottom: 24 }}>パズルを選ぶ</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400, margin: '0 auto' }}>
        {puzzles.map(puzzle => {
          const record = records.get(puzzle.id) ?? { bestTimeMs: null, discoveredSolutionIds: [], totalClears: 0 }
          return (
            <div key={puzzle.id} onClick={() => onSelect(puzzle.id)} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(100,200,255,0.15)',
              borderRadius: 12, padding: 16, cursor: 'pointer',
            }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>{puzzle.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                {puzzle.pieces.length} ピース · {puzzle.board.length} セル · {puzzle.gridType}
              </div>
              {record.totalClears > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                  <span>🏆 {record.bestTimeMs !== null ? formatTime(record.bestTimeMs) : '-'}</span>
                  <span>📋 {record.discoveredSolutionIds.length} 解発見</span>
                  <span onClick={e => { e.stopPropagation(); onGallery(puzzle.id) }}
                    style={{ color: 'rgba(100,200,255,0.7)', cursor: 'pointer' }}>解法一覧 →</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
