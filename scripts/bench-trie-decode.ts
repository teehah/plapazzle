#!/usr/bin/env npx tsx
/**
 * トライのバイナリシリアライズ/デシリアライズのベンチマーク。
 *
 * 測定項目:
 * 1. バイナリサイズ（ナイーブ vs トライ）
 * 2. デシリアライズ時間
 * 3. メモリフットプリント
 * 4. 比較: JSON parse vs バイナリデコード
 */

import { readFileSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const solutionsDir = resolve(__dirname, '..', 'public', 'solutions')

// -------------------------------------------------------------------
// 型定義
// -------------------------------------------------------------------

type TrieNode = {
  /** placement key for this node (empty string for root) */
  placementKey: string
  children: TrieNode[]
  /** solution indices that terminate here */
  solutionIds: number[]
}

// -------------------------------------------------------------------
// 解法読み込み
// -------------------------------------------------------------------

function loadRaw(puzzleId: string) {
  const filePath = resolve(solutionsDir, `${puzzleId}.json`)
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as {
    count: number
    solutions: [string, string][][]
  }
  return raw
}

function toPieceBased(solution: [string, string][]): Map<string, string> {
  const map = new Map<string, string[]>()
  for (const [cellKey, pieceId] of solution) {
    let cells = map.get(pieceId)
    if (!cells) { cells = []; map.set(pieceId, cells) }
    cells.push(cellKey)
  }
  const result = new Map<string, string>()
  for (const [pieceId, cells] of map) {
    result.set(pieceId, cells.sort().join(';'))
  }
  return result
}

// -------------------------------------------------------------------
// トライ構築
// -------------------------------------------------------------------

function buildTrie(
  placements: Map<string, string>[],
  pieceOrder: string[],
): TrieNode {
  const root: TrieNode = { placementKey: '', children: [], solutionIds: [] }

  for (let solIdx = 0; solIdx < placements.length; solIdx++) {
    const placement = placements[solIdx]
    let node = root
    for (const pieceId of pieceOrder) {
      const key = placement.get(pieceId) ?? ''
      let child = node.children.find(c => c.placementKey === key)
      if (!child) {
        child = { placementKey: key, children: [], solutionIds: [] }
        node.children.push(child)
      }
      node = child
    }
    node.solutionIds.push(solIdx)
  }

  return root
}

function countNodes(node: TrieNode): number {
  let count = 1
  for (const child of node.children) count += countNodes(child)
  return count
}

// -------------------------------------------------------------------
// バイナリエンコード（トライ）
// -------------------------------------------------------------------

/**
 * トライをバイナリにシリアライズ。
 *
 * フォーマット:
 *   Header:
 *     magic: 4 bytes "TRIE"
 *     pieceCount: 1 byte
 *     solutionCount: 2 bytes (uint16)
 *     nodeCount: 4 bytes (uint32)
 *     stringTableOffset: 4 bytes (uint32)
 *     stringTableSize: 4 bytes (uint32)
 *
 *   Node table (BFS order):
 *     Per node:
 *       stringTableIndex: 2 bytes (uint16) — placement key index in string table
 *       childCount: 1 byte (uint8)
 *       firstChildOffset: 4 bytes (uint32) — index into node table
 *       solutionCount: 1 byte (uint8)
 *       solutionIds: solutionCount * 2 bytes (uint16)
 *
 *   String table:
 *     count: 2 bytes (uint16)
 *     offsets: count * 4 bytes (uint32) — byte offsets within string data
 *     string data: concatenated UTF-8 strings
 */
function encodeTrie(root: TrieNode): ArrayBuffer {
  // Step 1: BFS to collect nodes and build string table
  const bfsNodes: TrieNode[] = []
  const nodeIndexMap = new Map<TrieNode, number>()
  const stringSet = new Map<string, number>() // string -> index
  const strings: string[] = []

  function internString(s: string): number {
    let idx = stringSet.get(s)
    if (idx === undefined) {
      idx = strings.length
      strings.push(s)
      stringSet.set(s, idx)
    }
    return idx
  }

  // BFS
  const queue: TrieNode[] = [root]
  while (queue.length > 0) {
    const node = queue.shift()!
    nodeIndexMap.set(node, bfsNodes.length)
    bfsNodes.push(node)
    internString(node.placementKey)
    for (const child of node.children) {
      queue.push(child)
    }
  }

  // Step 2: Compute sizes
  const headerSize = 4 + 1 + 2 + 4 + 4 + 4 // 19 bytes

  // Node sizes (variable per node due to solutionIds)
  let nodeTableSize = 0
  const nodeOffsets: number[] = []
  for (const node of bfsNodes) {
    nodeOffsets.push(nodeTableSize)
    nodeTableSize += 2 + 1 + 4 + 1 + node.solutionIds.length * 2 // strIdx + childCount + firstChild + solCount + sols
  }

  // String table
  const encoder = new TextEncoder()
  const encodedStrings = strings.map(s => encoder.encode(s))
  const stringDataSize = encodedStrings.reduce((sum, e) => sum + e.length, 0)
  const stringTableSize = 2 + strings.length * 4 + stringDataSize // count + offsets + data

  const totalSize = headerSize + nodeTableSize + stringTableSize
  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // Step 3: Write header
  let offset = 0
  bytes[offset++] = 0x54 // 'T'
  bytes[offset++] = 0x52 // 'R'
  bytes[offset++] = 0x49 // 'I'
  bytes[offset++] = 0x45 // 'E'
  view.setUint8(offset++, 0) // pieceCount (fill later from context)
  view.setUint16(offset, 0, true); offset += 2 // solutionCount
  view.setUint32(offset, bfsNodes.length, true); offset += 4
  view.setUint32(offset, headerSize + nodeTableSize, true); offset += 4 // stringTableOffset
  view.setUint32(offset, stringTableSize, true); offset += 4

  // Step 4: Write node table
  for (let i = 0; i < bfsNodes.length; i++) {
    const node = bfsNodes[i]
    const strIdx = stringSet.get(node.placementKey)!
    view.setUint16(offset, strIdx, true); offset += 2
    view.setUint8(offset++, node.children.length)

    // First child offset (index into node table)
    const firstChildIdx = node.children.length > 0 ? nodeIndexMap.get(node.children[0])! : 0
    view.setUint32(offset, firstChildIdx, true); offset += 4

    view.setUint8(offset++, node.solutionIds.length)
    for (const solId of node.solutionIds) {
      view.setUint16(offset, solId, true); offset += 2
    }
  }

  // Step 5: Write string table
  view.setUint16(offset, strings.length, true); offset += 2
  let strDataStart = offset + strings.length * 4
  let strDataOffset = 0
  for (const encoded of encodedStrings) {
    view.setUint32(offset, strDataOffset, true); offset += 4
    strDataOffset += encoded.length
  }
  // Write string data
  for (const encoded of encodedStrings) {
    bytes.set(encoded, strDataStart)
    strDataStart += encoded.length
  }

  return buffer
}

// -------------------------------------------------------------------
// バイナリデコード（トライ）
// -------------------------------------------------------------------

type DecodedNode = {
  placementKey: string
  childCount: number
  firstChildIndex: number
  solutionIds: number[]
}

function decodeTrie(buffer: ArrayBuffer): DecodedNode[] {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const decoder = new TextDecoder()

  // Read header
  let offset = 4 // skip magic
  const _pieceCount = view.getUint8(offset++);
  const _solutionCount = view.getUint16(offset, true); offset += 2
  const nodeCount = view.getUint32(offset, true); offset += 4
  const stringTableOffset = view.getUint32(offset, true); offset += 4
  const _stringTableSize = view.getUint32(offset, true); offset += 4

  // Read string table
  let strOffset = stringTableOffset
  const strCount = view.getUint16(strOffset, true); strOffset += 2
  const strOffsets: number[] = []
  for (let i = 0; i < strCount; i++) {
    strOffsets.push(view.getUint32(strOffset, true)); strOffset += 4
  }
  const strDataStart = strOffset
  const strings: string[] = []
  for (let i = 0; i < strCount; i++) {
    const start = strDataStart + strOffsets[i]
    const end = i < strCount - 1 ? strDataStart + strOffsets[i + 1] : stringTableOffset + _stringTableSize
    strings.push(decoder.decode(bytes.slice(start, end)))
  }

  // Read node table
  offset = 19 // after header
  const nodes: DecodedNode[] = []
  for (let i = 0; i < nodeCount; i++) {
    const strIdx = view.getUint16(offset, true); offset += 2
    const childCount = view.getUint8(offset++);
    const firstChildIndex = view.getUint32(offset, true); offset += 4
    const solCount = view.getUint8(offset++);
    const solutionIds: number[] = []
    for (let j = 0; j < solCount; j++) {
      solutionIds.push(view.getUint16(offset, true)); offset += 2
    }
    nodes.push({
      placementKey: strings[strIdx],
      childCount,
      firstChildIndex,
      solutionIds,
    })
  }

  return nodes
}

// -------------------------------------------------------------------
// ナイーブバイナリ（比較用）
// -------------------------------------------------------------------

/**
 * ナイーブ: 各解を pieceOrder 順に配置キーを並べたフラット配列。
 * 各配置キーをstring tableのインデックスで参照。
 * solution * pieceCount * 2 bytes
 */
function encodeNaive(placements: Map<string, string>[], pieceOrder: string[]): ArrayBuffer {
  const stringSet = new Map<string, number>()
  const strings: string[] = []
  function intern(s: string): number {
    let idx = stringSet.get(s)
    if (idx === undefined) { idx = strings.length; strings.push(s); stringSet.set(s, idx) }
    return idx
  }

  for (const p of placements) {
    for (const pid of pieceOrder) intern(p.get(pid) ?? '')
  }

  const encoder = new TextEncoder()
  const encodedStrings = strings.map(s => encoder.encode(s))
  const stringDataSize = encodedStrings.reduce((sum, e) => sum + e.length, 0)

  const headerSize = 4 + 2 + 1 // magic + solutionCount + pieceCount
  const dataSize = placements.length * pieceOrder.length * 2
  const stringTableSize = 2 + strings.length * 4 + stringDataSize
  const totalSize = headerSize + dataSize + stringTableSize

  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  let offset = 0
  bytes[offset++] = 0x4E; bytes[offset++] = 0x41; bytes[offset++] = 0x49; bytes[offset++] = 0x56 // "NAIV"
  view.setUint16(offset, placements.length, true); offset += 2
  view.setUint8(offset++, pieceOrder.length)

  for (const p of placements) {
    for (const pid of pieceOrder) {
      view.setUint16(offset, intern(p.get(pid) ?? ''), true); offset += 2
    }
  }

  // string table (same format)
  view.setUint16(offset, strings.length, true); offset += 2
  let strDataStart = offset + strings.length * 4
  let strDataOffset = 0
  for (const encoded of encodedStrings) {
    view.setUint32(offset, strDataOffset, true); offset += 4
    strDataOffset += encoded.length
  }
  for (const encoded of encodedStrings) {
    bytes.set(encoded, strDataStart)
    strDataStart += encoded.length
  }

  return buffer
}

// -------------------------------------------------------------------
// ベンチマーク
// -------------------------------------------------------------------

function bench(name: string, fn: () => void, iterations: number = 100): { avg: number; min: number; max: number } {
  // Warmup
  for (let i = 0; i < 5; i++) fn()

  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    fn()
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  return {
    avg: times.reduce((a, b) => a + b) / times.length,
    min: times[0],
    max: times[times.length - 1],
  }
}

// -------------------------------------------------------------------
// メイン
// -------------------------------------------------------------------

const puzzleId = process.argv[2] || 'no6'

// NO6 の最適順序（analyze-trie.ts の結果）
const BEST_ORDERS: Record<string, string[]> = {
  'no6': ['O', 'I', 'X', 'C', 'S', 'E', 'H', 'P', 'J', 'G', 'F', 'V'],
  'pentomino-6x10': ['X', 'I', 'V', 'U', 'L', 'T', 'Y', 'W', 'P', 'Z', 'F', 'N'],
  'pentomino-8x8': ['X', 'I', 'Q', 'U', 'V', 'T', 'Y', 'L', 'W', 'P', 'F', 'N', 'Z'],
  'tetromino-5x8': ['I', 'O', 'T', 'S', 'L'],
}

console.log(`\nBenchmark: ${puzzleId}`)
console.log('='.repeat(60))

// Load and convert
const raw = loadRaw(puzzleId)
const placements = raw.solutions.map(toPieceBased)
const pieceIds = new Set<string>()
for (const p of placements) for (const id of p.keys()) pieceIds.add(id)
const pieceOrder = BEST_ORDERS[puzzleId] ?? [...pieceIds].sort()

console.log(`Solutions: ${placements.length}, Pieces: ${pieceOrder.length}`)

// Build trie
const trie = buildTrie(placements, pieceOrder)
const nodeCount = countNodes(trie)
console.log(`Trie nodes: ${nodeCount}`)

// Encode
const trieBinary = encodeTrie(trie)
const naiveBinary = encodeNaive(placements, pieceOrder)
const jsonStr = JSON.stringify(raw)
const jsonBytes = new TextEncoder().encode(jsonStr)

console.log(`\nData sizes:`)
console.log(`  JSON:         ${(jsonBytes.length / 1024).toFixed(1)} KB`)
console.log(`  Naive binary: ${(naiveBinary.byteLength / 1024).toFixed(1)} KB`)
console.log(`  Trie binary:  ${(trieBinary.byteLength / 1024).toFixed(1)} KB`)

// Decode benchmarks
console.log(`\nDecode performance (100 iterations):`)

const jsonParse = bench('JSON.parse', () => {
  JSON.parse(jsonStr)
})
console.log(`  JSON.parse:       avg=${jsonParse.avg.toFixed(2)}ms  min=${jsonParse.min.toFixed(2)}ms  max=${jsonParse.max.toFixed(2)}ms`)

const trieDecode = bench('Trie decode', () => {
  decodeTrie(trieBinary)
})
console.log(`  Trie decode:      avg=${trieDecode.avg.toFixed(2)}ms  min=${trieDecode.min.toFixed(2)}ms  max=${trieDecode.max.toFixed(2)}ms`)

const trieDecodeAndBuild = bench('Trie decode+map', () => {
  const nodes = decodeTrie(trieBinary)
  // Build a lookup structure
  const nodeMap = new Map<number, DecodedNode>()
  for (let i = 0; i < nodes.length; i++) nodeMap.set(i, nodes[i])
})
console.log(`  Trie decode+map:  avg=${trieDecodeAndBuild.avg.toFixed(2)}ms  min=${trieDecodeAndBuild.min.toFixed(2)}ms  max=${trieDecodeAndBuild.max.toFixed(2)}ms`)

const jsonParseAndConvert = bench('JSON parse+convert', () => {
  const parsed = JSON.parse(jsonStr) as { solutions: [string, string][][] }
  parsed.solutions.map(toPieceBased)
})
console.log(`  JSON parse+conv:  avg=${jsonParseAndConvert.avg.toFixed(2)}ms  min=${jsonParseAndConvert.min.toFixed(2)}ms  max=${jsonParseAndConvert.max.toFixed(2)}ms`)

// Memory footprint (rough estimate)
console.log(`\nMemory footprint (estimated):`)

// Trie nodes as flat array
const trieMemory = nodeCount * (
  8 +   // object overhead
  16 +  // placementKey string (avg)
  4 +   // childCount
  4 +   // firstChildIndex
  16    // solutionIds array
)
console.log(`  Trie (flat array): ~${(trieMemory / 1024).toFixed(0)} KB`)

// JSON parsed
const jsonMemory = jsonBytes.length * 2 // rough: parsed JSON ≈ 2x raw size in memory
console.log(`  JSON (parsed):     ~${(jsonMemory / 1024).toFixed(0)} KB`)

// ハイブリッド: ナイーブバイナリからトライを構築
function decodeNaiveToArray(buffer: ArrayBuffer, pieceCount: number): { placements: Map<string, string>[], pieceOrder: string[] } {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const decoder = new TextDecoder()

  let offset = 4 // skip magic
  const solutionCount = view.getUint16(offset, true); offset += 2
  const pc = view.getUint8(offset++);

  // Read placement indices
  const indices: number[][] = []
  for (let s = 0; s < solutionCount; s++) {
    const row: number[] = []
    for (let p = 0; p < pc; p++) {
      row.push(view.getUint16(offset, true)); offset += 2
    }
    indices.push(row)
  }

  // Read string table
  const strCount = view.getUint16(offset, true); offset += 2
  const strOffsets: number[] = []
  for (let i = 0; i < strCount; i++) {
    strOffsets.push(view.getUint32(offset, true)); offset += 4
  }
  const strDataStart = offset
  const strings: string[] = []
  for (let i = 0; i < strCount; i++) {
    const start = strDataStart + strOffsets[i]
    const end = i < strCount - 1 ? strDataStart + strOffsets[i + 1] : buffer.byteLength
    strings.push(decoder.decode(bytes.slice(start, end)))
  }

  const result: Map<string, string>[] = []
  for (const row of indices) {
    const m = new Map<string, string>()
    for (let p = 0; p < pc; p++) {
      m.set(pieceOrder[p], strings[row[p]])
    }
    result.push(m)
  }
  return { placements: result, pieceOrder }
}

type SimpleTrieNode = {
  children: Map<string, SimpleTrieNode>
  solutionIds: number[]
}

function buildTrieFromFlat(placements: Map<string, string>[], order: string[]): SimpleTrieNode {
  const root: SimpleTrieNode = { children: new Map(), solutionIds: [] }
  for (let i = 0; i < placements.length; i++) {
    let node = root
    for (const pid of order) {
      const key = placements[i].get(pid) ?? ''
      let child = node.children.get(key)
      if (!child) {
        child = { children: new Map(), solutionIds: [] }
        node.children.set(key, child)
      }
      node = child
    }
    node.solutionIds.push(i)
  }
  return root
}

const hybridDecode = bench('Hybrid: naive decode', () => {
  decodeNaiveToArray(naiveBinary, pieceOrder.length)
})
console.log(`\n  Naive decode:     avg=${hybridDecode.avg.toFixed(2)}ms  min=${hybridDecode.min.toFixed(2)}ms  max=${hybridDecode.max.toFixed(2)}ms`)

const hybridBuild = bench('Hybrid: build trie', () => {
  buildTrieFromFlat(placements, pieceOrder)
})
console.log(`  Trie build:       avg=${hybridBuild.avg.toFixed(2)}ms  min=${hybridBuild.min.toFixed(2)}ms  max=${hybridBuild.max.toFixed(2)}ms`)

const hybridTotal = bench('Hybrid: decode+build', () => {
  const { placements: ps, pieceOrder: po } = decodeNaiveToArray(naiveBinary, pieceOrder.length)
  buildTrieFromFlat(ps, po)
})
console.log(`  Total:            avg=${hybridTotal.avg.toFixed(2)}ms  min=${hybridTotal.min.toFixed(2)}ms  max=${hybridTotal.max.toFixed(2)}ms`)

// Summary
console.log(`\n${'='.repeat(60)}`)
console.log(`Summary:`)
console.log(`  Option A (Trie binary):   ${(trieBinary.byteLength / 1024).toFixed(0)} KB → ${trieDecode.avg.toFixed(1)}ms decode`)
console.log(`  Option B (Hybrid):        ${(naiveBinary.byteLength / 1024).toFixed(0)} KB → ${hybridTotal.avg.toFixed(1)}ms decode+build`)
console.log(`  Diff: ${((trieBinary.byteLength - naiveBinary.byteLength) / 1024).toFixed(0)} KB larger / ${(hybridTotal.avg - trieDecode.avg).toFixed(1)}ms slower`)
