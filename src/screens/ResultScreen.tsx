type Props = {
  clearTimeMs: number
  solutionId: number
  onPlayAgain: () => void
  onBack: () => void
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  const milli = Math.floor((ms % 1000) / 10)
  return `${m}:${sec.toString().padStart(2, '0')}.${milli.toString().padStart(2, '0')}`
}

export function ResultScreen({ clearTimeMs, solutionId, onPlayAgain, onBack }: Props) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #e8e0d8, #d8e0d4)',
      fontFamily: 'sans-serif', color: '#34495e',
    }}>
      <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.4)', letterSpacing: 3 }}>CLEAR!</div>
      <div style={{ fontSize: 48, fontWeight: 700, marginTop: 8 }}>{formatTime(clearTimeMs)}</div>
      <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.35)', marginTop: 8 }}>解法 #{solutionId}</div>
      <div style={{ marginTop: 40, display: 'flex', gap: 16 }}>
        <button onClick={onPlayAgain} style={{
          padding: '12px 28px', border: '1px solid rgba(39,174,96,0.4)',
          borderRadius: 25, background: 'transparent', color: 'rgba(39,174,96,0.9)',
          fontSize: 14, cursor: 'pointer',
        }}>もう一度</button>
        <button onClick={onBack} style={{
          padding: '12px 28px', border: '1px solid rgba(52,73,94,0.25)',
          borderRadius: 25, background: 'transparent', color: 'rgba(52,73,94,0.6)',
          fontSize: 14, cursor: 'pointer',
        }}>パズル選択</button>
      </div>
    </div>
  )
}
