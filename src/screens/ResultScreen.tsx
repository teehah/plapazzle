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
      background: 'linear-gradient(135deg, #0a0a1a, #1a2a1a)',
      fontFamily: 'sans-serif', color: '#fff',
    }}>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', letterSpacing: 3 }}>CLEAR!</div>
      <div style={{ fontSize: 48, fontWeight: 700, marginTop: 8 }}>{formatTime(clearTimeMs)}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>解法 #{solutionId}</div>
      <div style={{ marginTop: 40, display: 'flex', gap: 16 }}>
        <button onClick={onPlayAgain} style={{
          padding: '12px 28px', border: '1px solid rgba(100,255,100,0.3)',
          borderRadius: 25, background: 'transparent', color: 'rgba(100,255,100,0.8)',
          fontSize: 14, cursor: 'pointer',
        }}>もう一度</button>
        <button onClick={onBack} style={{
          padding: '12px 28px', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 25, background: 'transparent', color: 'rgba(255,255,255,0.5)',
          fontSize: 14, cursor: 'pointer',
        }}>パズル選択</button>
      </div>
    </div>
  )
}
