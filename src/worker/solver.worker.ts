import { buildAndSolve } from '../core/solver'
import type { Solution, WorkerInput, WorkerResult } from '../core/solver'

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { board, pieces } = e.data
  const solutions: Array<[string, string][]> = []

  buildAndSolve(board, pieces, (sol: Solution) => {
    solutions.push([...sol.entries()])
  })

  self.postMessage({ solutions } as WorkerResult)
}
