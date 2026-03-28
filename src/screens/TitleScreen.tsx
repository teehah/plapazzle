type Props = { onStart: () => void }

export function TitleScreen({ onStart }: Props) {
  return (
    <div
      onClick={onStart}
      style={{
        minHeight: '100dvh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%)',
        cursor: 'pointer', userSelect: 'none', fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: 3 }}>POLYFORM</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: 5, marginTop: 4 }}>PACKING PUZZLE</div>
      <div style={{
        marginTop: 40, padding: '10px 40px',
        border: '1px solid rgba(100,200,255,0.3)', borderRadius: 25,
        color: 'rgba(100,200,255,0.8)', fontSize: 13, letterSpacing: 2,
      }}>TAP TO START</div>
    </div>
  )
}
