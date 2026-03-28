import { buildAndSolve } from '../core/solver'
import { GRID_OPS } from '../core/grid-ops'
import type { Solution, WorkerInput, WorkerResult } from '../core/solver'

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { board, pieces, gridType } = e.data
  const ops = GRID_OPS[gridType]
  const solutions: Array<[string, string][]> = []

  buildAndSolve(board, pieces, (sol: Solution) => {
    solutions.push([...sol.entries()])
  }, ops.uniqueOrientations, ops.neighbors)

  self.postMessage({ solutions } as WorkerResult)
}
