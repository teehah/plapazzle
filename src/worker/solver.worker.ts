import { buildAndSolve } from '../core/solver'
import { NO6_BOARD } from '../data/no6'
import { PIECES } from '../core/piece'
import type { Solution, WorkerResult } from '../core/solver'

const solutions: Array<[string, string][]> = []

buildAndSolve(NO6_BOARD.cells, PIECES, (sol: Solution) => {
  solutions.push([...sol.entries()])
})

self.postMessage({ solutions } as WorkerResult)
