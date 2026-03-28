import { useState, useCallback } from 'react'
import { Board } from './ui/Board'
import { Controls } from './ui/Controls'
import { PUZZLES } from './data/puzzles'
import { GRID_OPS } from './core/grid-ops'
import type { Solution, WorkerResult, WorkerInput } from './core/solver'

export default function App() {
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const [solutions, setSolutions] = useState<Solution[]>([])
  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<'idle' | 'solving' | 'done'>('idle')

  const puzzle = PUZZLES[puzzleIndex]

  const handleSolve = useCallback(async () => {
    setStatus('solving')
    setSolutions([])
    setIndex(0)

    // 静的ファイルがあればそこからロード
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}solutions/${puzzle.id}.json`)
      if (res.ok) {
        const data = await res.json()
        const sols: Solution[] = data.solutions.map(
          (entries: [string, string][]) => new Map(entries)
        )
        setSolutions(sols)
        setStatus('done')
        return
      }
    } catch {
      // fetch失敗 → Worker にフォールバック
    }

    // フォールバック: WebWorker でリアルタイム計算
    const worker = new Worker(
      new URL('./worker/solver.worker.ts', import.meta.url),
      { type: 'module' }
    )
    worker.postMessage({ board: puzzle.board, pieces: puzzle.pieces, gridType: puzzle.gridType } satisfies WorkerInput)
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
  }, [puzzle])

  const handlePuzzleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setPuzzleIndex(Number(e.target.value))
    setSolutions([])
    setIndex(0)
    setStatus('idle')
  }, [])

  const currentSolution = solutions[index] ?? null

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1 style={{ textAlign: 'center' }}>{puzzle.name} ソルバ</h1>
      {PUZZLES.length > 1 && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <select value={puzzleIndex} onChange={handlePuzzleChange}>
            {PUZZLES.map((p, i) => (
              <option key={p.id} value={i}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
      <Board cells={puzzle.board} pieces={puzzle.pieces} grid={GRID_OPS[puzzle.gridType]} solution={currentSolution} />
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
