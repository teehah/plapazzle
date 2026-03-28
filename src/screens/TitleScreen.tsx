type Props = { onStart: () => void }

export function TitleScreen({ onStart }: Props) {
  return (
    <div
      onClick={onStart}
      style={{
        minHeight: '100dvh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #e8e0d8 0%, #d4c8be 100%)',
        cursor: 'pointer', userSelect: 'none', fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color: '#34495e', letterSpacing: 3 }}>POLYFORM</div>
      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)', letterSpacing: 5, marginTop: 4 }}>PACKING PUZZLE</div>
      <div style={{
        marginTop: 40, padding: '10px 40px',
        border: '1px solid rgba(52,73,94,0.3)', borderRadius: 25,
        color: 'rgba(52,73,94,0.7)', fontSize: 13, letterSpacing: 2,
      }}>TAP TO START</div>
    </div>
  )
}
