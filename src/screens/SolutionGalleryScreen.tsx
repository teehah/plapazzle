type Props = {
  puzzleId: string
  discoveredIds: number[]
  onBack: () => void
}

export function SolutionGalleryScreen({ puzzleId: _puzzleId, discoveredIds, onBack }: Props) {
  void _puzzleId // reserved for future use (e.g. rendering board preview)
  return (
    <div style={{
      minHeight: '100dvh', background: 'linear-gradient(135deg, #e8e0d8, #d4c8be)',
      padding: 24, fontFamily: 'sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: 'none',
          color: 'rgba(52,73,94,0.7)', fontSize: 14, cursor: 'pointer', padding: 0,
        }}>← 戻る</button>
        <h2 style={{ color: '#34495e', fontSize: 16, marginLeft: 16 }}>
          解法一覧（{discoveredIds.length} 件）
        </h2>
      </div>
      {discoveredIds.length === 0 ? (
        <div style={{ color: 'rgba(0,0,0,0.35)', textAlign: 'center', marginTop: 60 }}>
          まだ解法が見つかっていません
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: 12, maxWidth: 600, margin: '0 auto',
        }}>
          {discoveredIds.map(id => (
            <div key={id} style={{
              aspectRatio: '1', background: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(52,73,94,0.1)', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(52,73,94,0.6)', fontSize: 14,
            }}>#{id}</div>
          ))}
        </div>
      )}
    </div>
  )
}
