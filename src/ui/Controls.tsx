type Props = {
  status: 'idle' | 'solving' | 'done'
  total: number
  index: number
  onSolve: () => void
  onPrev: () => void
  onNext: () => void
}

export function Controls({ status, total, index, onSolve, onPrev, onNext }: Props) {
  return (
    <div style={{ textAlign: 'center', marginTop: 16 }}>
      <button onClick={onSolve} disabled={status === 'solving'}>
        {status === 'solving' ? '計算中...' : 'Solve'}
      </button>
      {status === 'done' && total === 0 && <span style={{ marginLeft: 8 }}>解なし</span>}
      {total > 0 && (
        <>
          <button onClick={onPrev} disabled={index === 0} style={{ marginLeft: 8 }}>←</button>
          <span style={{ margin: '0 8px' }}>解: {index + 1} / {total}</span>
          <button onClick={onNext} disabled={index === total - 1}>→</button>
        </>
      )}
    </div>
  )
}
