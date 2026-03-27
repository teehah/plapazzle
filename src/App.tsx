import { useState, useCallback } from 'react'
import { Board } from './ui/Board'
import { Controls } from './ui/Controls'
import type { Solution, WorkerResult } from './core/solver'

export default function App() {
  const [solutions, setSolutions] = useState<Solution[]>([])
  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<'idle' | 'solving' | 'done'>('idle')

  const handleSolve = useCallback(() => {
    setStatus('solving')
    setSolutions([])
    setIndex(0)
    const worker = new Worker(
      new URL('./worker/solver.worker.ts', import.meta.url),
      { type: 'module' }
    )
    worker.onmessage = (e: MessageEvent<WorkerResult>) => {
      const sols: Solution[] = e.data.solutions.map(entries => new Map(entries))
      setSolutions(sols)
      setStatus('done')
      worker.terminate()
    }
    worker.onerror = (err) => {
      console.error('Worker error:', err)
      setStatus('done')
      worker.terminate()
    }
  }, [])

  const currentSolution = solutions[index] ?? null

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1 style={{ textAlign: 'center' }}>プラパズル No.6 ソルバ</h1>
      <Board solution={currentSolution} />
      <Controls
        status={status}
        total={solutions.length}
        index={index}
        onSolve={handleSolve}
        onPrev={() => setIndex(i => i - 1)}
        onNext={() => setIndex(i => i + 1)}
      />
    </div>
  )
}
