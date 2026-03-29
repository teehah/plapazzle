#!/usr/bin/env npx tsx
/**
 * ビルド時に全パズルの解を算出し、ナイーブバイナリとして出力する。
 * 同一ピース入れ替えによる重複は Solution マップで自動排除される。
 *
 * 出力: public/solutions/<puzzleId>.bin
 *
 * バイナリフォーマット:
 *   Header (7 bytes):
 *     magic: 4 bytes "SOLV"
 *     pieceCount: 1 byte (uint8)
 *     solutionCount: 2 bytes (uint16 LE)
 *   Piece order table:
 *     pieceCount × uint16 LE (string table index of pieceId)
 *   Solution table:
 *     solutionCount × pieceCount × uint16 LE (string table index of placement key)
 *   String table:
 *     count: 2 bytes (uint16 LE)
 *     offsets: count × 4 bytes (uint32 LE) — byte offset into data
 *     data: concatenated UTF-8 strings
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

// 最適ピース順序（analyze-trie.ts の結果）
const OPTIMAL_PIECE_ORDER: Record<string, string[]> = {
  'no6': ['O', 'I', 'X', 'C', 'S', 'E', 'H', 'P', 'J', 'G', 'F', 'V'],
  'pentomino-6x10': ['X', 'I', 'V', 'U', 'L', 'T', 'Y', 'W', 'P', 'Z', 'F', 'N'],
  'pentomino-8x8': ['X', 'I', 'Q', 'U', 'V', 'T', 'Y', 'L', 'W', 'P', 'F', 'N', 'Z'],
  'tetromino-5x8': ['I', 'O', 'T', 'S', 'L'],
}

/**
 * セルベースの解法 ([cellKey, pieceId][]) を
 * ピースベース (pieceId -> ソート済みセルキー列) に変換
 */
function toPieceBased(sol: Solution): Map<string, string> {
  const map = new Map<string, string[]>()
  for (const [ck, pieceId] of sol) {
    let cells = map.get(pieceId)
    if (!cells) {
      cells = []
      map.set(pieceId, cells)
    }
    cells.push(ck)
  }
  const result = new Map<string, string>()
  for (const [pieceId, cells] of map) {
    result.set(pieceId, cells.sort().join(';'))
  }
  return result
}

function encodeBinary(
  pieceOrder: string[],
  placements: Map<string, string>[],
): Buffer {
  const pieceCount = pieceOrder.length
  const solutionCount = placements.length

  // Build string table: collect all unique strings (pieceIds + placement keys)
  const stringToIndex = new Map<string, number>()
  const strings: string[] = []

  function intern(s: string): number {
    let idx = stringToIndex.get(s)
    if (idx === undefined) {
      idx = strings.length
      stringToIndex.set(s, idx)
      strings.push(s)
    }
    return idx
  }

  // Intern piece IDs
  const pieceOrderIndices = pieceOrder.map(id => intern(id))

  // Intern placement keys and build solution table
  const solutionTable: number[][] = []
  for (const placement of placements) {
    const row: number[] = []
    for (const pieceId of pieceOrder) {
      const key = placement.get(pieceId) ?? ''
      row.push(intern(key))
    }
    solutionTable.push(row)
  }

  // Encode string table data
  const encoder = new TextEncoder()
  const encodedStrings = strings.map(s => encoder.encode(s))
  const totalStringBytes = encodedStrings.reduce((sum, e) => sum + e.length, 0)

  // Calculate total buffer size
  const headerSize = 7
  const pieceOrderSize = pieceCount * 2
  const solutionTableSize = solutionCount * pieceCount * 2
  const stringTableHeaderSize = 2 + strings.length * 4
  const totalSize = headerSize + pieceOrderSize + solutionTableSize + stringTableHeaderSize + totalStringBytes

  const buffer = Buffer.alloc(totalSize)
  let offset = 0

  // Header
  buffer.write('SOLV', offset, 4, 'ascii')
  offset += 4
  buffer.writeUInt8(pieceCount, offset)
  offset += 1
  buffer.writeUInt16LE(solutionCount, offset)
  offset += 2

  // Piece order table
  for (const idx of pieceOrderIndices) {
    buffer.writeUInt16LE(idx, offset)
    offset += 2
  }

  // Solution table
  for (const row of solutionTable) {
    for (const idx of row) {
      buffer.writeUInt16LE(idx, offset)
      offset += 2
    }
  }

  // String table
  buffer.writeUInt16LE(strings.length, offset)
  offset += 2

  // String offsets
  let dataOffset = 0
  for (const encoded of encodedStrings) {
    buffer.writeUInt32LE(dataOffset, offset)
    offset += 4
    dataOffset += encoded.length
  }

  // String data
  for (const encoded of encodedStrings) {
    encoded.forEach((byte, i) => {
      buffer[offset + i] = byte
    })
    offset += encoded.length
  }

  return buffer
}

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

  // 重複排除（同一ピース入れ替え + ボード対称性）
  const unique = deduplicateSolutions(allSolutions, puzzle.board, puzzle.boardSymmetries)
  console.log(`  Raw: ${allSolutions.length} → Dedup: ${unique.length}`)

  // ピース順序の決定
  const pieceOrder = OPTIMAL_PIECE_ORDER[puzzle.id]
  if (!pieceOrder) {
    console.error(`  ERROR: No optimal piece order defined for ${puzzle.id}`)
    process.exit(1)
  }

  // ピースベースに変換
  const placements = unique.map(toPieceBased)

  // バイナリ出力
  const binary = encodeBinary(pieceOrder, placements)
  const outPath = resolve(outDir, `${puzzle.id}.bin`)
  writeFileSync(outPath, binary)
  const sizeKB = (binary.length / 1024).toFixed(1)
  console.log(`  Piece order: [${pieceOrder.join(', ')}]`)
  console.log(`  Output: ${outPath} (${sizeKB} KB)`)
  console.log(`  Time: ${((Date.now() - start) / 1000).toFixed(1)}s`)
}

console.log('\nDone.')
