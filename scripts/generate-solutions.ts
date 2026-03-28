#!/usr/bin/env npx tsx
/**
 * ビルド時に全パズルの解を算出し、static JSON として出力する。
 * 同一ピース入れ替えによる重複は Solution マップで自動排除される。
 *
 * 出力: public/solutions/<puzzleId>.json
 * 形式: { count: number, solutions: [string, string][][] }
 */

import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
import { PUZZLES } from '../src/data/puzzles'
import { buildAndSolve } from '../src/core/solver'
import { GRID_OPS } from '../src/core/grid-ops'
import { deduplicateSolutions } from '../src/core/solution-utils'
import type { Solution } from '../src/core/solver'

const TIMEOUT_MS = 120_000  // パズルあたり最大2分
const outDir = resolve(__dirname, '..', 'public', 'solutions')
mkdirSync(outDir, { recursive: true })

for (const puzzle of PUZZLES) {
  console.log(`\n=== ${puzzle.name} (${puzzle.id}) ===`)
  const ops = GRID_OPS[puzzle.gridType]

  const allSolutions: Solution[] = []
  const start = Date.now()
  let timedOut = false

  buildAndSolve(
    puzzle.board,
    puzzle.pieces,
    (sol) => {
      if (Date.now() - start > TIMEOUT_MS) {
        timedOut = true
        return
      }
      allSolutions.push(new Map(sol))
    },
    ops.uniqueOrientations,
    ops.neighbors,
  )

  if (timedOut) {
    console.log(`  TIMEOUT (>${TIMEOUT_MS / 1000}s) — ${allSolutions.length} solutions found before timeout`)
  }

  // 重複排除（同一ピース入れ替え）
  const unique = deduplicateSolutions(allSolutions)
  console.log(`  Raw: ${allSolutions.length} → Dedup: ${unique.length}`)

  // JSON出力
  const serialized = unique.map(sol => [...sol.entries()])
  const json = JSON.stringify({ count: unique.length, solutions: serialized })
  const outPath = resolve(outDir, `${puzzle.id}.json`)
  writeFileSync(outPath, json)
  const sizeKB = (Buffer.byteLength(json) / 1024).toFixed(1)
  console.log(`  Output: ${outPath} (${sizeKB} KB)`)
  console.log(`  Time: ${((Date.now() - start) / 1000).toFixed(1)}s`)
}

console.log('\nDone.')
