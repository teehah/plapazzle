import { describe, it, expect } from 'vitest'
import { decodeSolutions } from '../solution-loader'

/**
 * テスト用のバイナリを組み立てるヘルパー。
 * generate-solutions.ts と同じフォーマットで ArrayBuffer を生成する。
 */
function buildTestBinary(
  pieceOrder: string[],
  placements: string[][],
): ArrayBuffer {
  const encoder = new TextEncoder()
  const pieceCount = pieceOrder.length
  const solutionCount = placements.length

  // String table construction
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

  const pieceOrderIndices = pieceOrder.map(intern)
  const solutionIndices = placements.map(row => row.map(intern))

  const encodedStrings = strings.map(s => encoder.encode(s))
  const totalStringBytes = encodedStrings.reduce((sum, e) => sum + e.length, 0)

  // Calculate buffer size
  const headerSize = 7
  const pieceOrderSize = pieceCount * 2
  const solutionTableSize = solutionCount * pieceCount * 2
  const stringTableHeaderSize = 2 + strings.length * 4
  const totalSize = headerSize + pieceOrderSize + solutionTableSize + stringTableHeaderSize + totalStringBytes

  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  let offset = 0

  // Header
  const magic = encoder.encode('SOLV')
  bytes.set(magic, 0)
  offset = 4
  view.setUint8(offset, pieceCount)
  offset += 1
  view.setUint16(offset, solutionCount, true)
  offset += 2

  // Piece order
  for (const idx of pieceOrderIndices) {
    view.setUint16(offset, idx, true)
    offset += 2
  }

  // Solution table
  for (const row of solutionIndices) {
    for (const idx of row) {
      view.setUint16(offset, idx, true)
      offset += 2
    }
  }

  // String table count
  view.setUint16(offset, strings.length, true)
  offset += 2

  // String offsets
  let dataOffset = 0
  for (const encoded of encodedStrings) {
    view.setUint32(offset, dataOffset, true)
    offset += 4
    dataOffset += encoded.length
  }

  // String data
  for (const encoded of encodedStrings) {
    bytes.set(encoded, offset)
    offset += encoded.length
  }

  return buffer
}

describe('decodeSolutions', () => {
  it('should decode a simple binary with 2 pieces and 2 solutions', () => {
    const pieceOrder = ['A', 'B']
    const placements = [
      ['0,0,0;0,1,0', '1,0,0;1,1,0'],
      ['0,0,0;1,0,0', '0,1,0;1,1,0'],
    ]

    const buffer = buildTestBinary(pieceOrder, placements)
    const result = decodeSolutions(buffer)

    expect(result.pieceOrder).toEqual(['A', 'B'])
    expect(result.placements).toHaveLength(2)
    expect(result.placements[0]).toEqual(['0,0,0;0,1,0', '1,0,0;1,1,0'])
    expect(result.placements[1]).toEqual(['0,0,0;1,0,0', '0,1,0;1,1,0'])
  })

  it('should decode a single piece single solution', () => {
    const pieceOrder = ['X']
    const placements = [['0,0,0;0,1,0;1,0,0']]

    const buffer = buildTestBinary(pieceOrder, placements)
    const result = decodeSolutions(buffer)

    expect(result.pieceOrder).toEqual(['X'])
    expect(result.placements).toEqual([['0,0,0;0,1,0;1,0,0']])
  })

  it('should handle shared placement keys across solutions', () => {
    const pieceOrder = ['A', 'B']
    const placements = [
      ['shared-key', 'val1'],
      ['shared-key', 'val2'],
    ]

    const buffer = buildTestBinary(pieceOrder, placements)
    const result = decodeSolutions(buffer)

    expect(result.placements[0][0]).toBe('shared-key')
    expect(result.placements[1][0]).toBe('shared-key')
    expect(result.placements[0][1]).toBe('val1')
    expect(result.placements[1][1]).toBe('val2')
  })

  it('should reject invalid magic', () => {
    const buffer = new ArrayBuffer(16)
    const view = new DataView(buffer)
    const bytes = new Uint8Array(buffer)
    const encoder = new TextEncoder()
    bytes.set(encoder.encode('BADS'), 0)
    view.setUint8(4, 0)
    view.setUint16(5, 0, true)
    view.setUint16(7, 0, true)

    expect(() => decodeSolutions(buffer)).toThrow('Invalid magic')
  })

  it('should handle many pieces and solutions', () => {
    const pieceOrder = ['A', 'B', 'C', 'D', 'E']
    const placements: string[][] = []
    for (let i = 0; i < 100; i++) {
      placements.push(pieceOrder.map((_, j) => `cell-${i}-${j}`))
    }

    const buffer = buildTestBinary(pieceOrder, placements)
    const result = decodeSolutions(buffer)

    expect(result.pieceOrder).toEqual(pieceOrder)
    expect(result.placements).toHaveLength(100)
    expect(result.placements[42][3]).toBe('cell-42-3')
  })

  it('should handle UTF-8 cell keys (triangular grid format)', () => {
    const pieceOrder = ['I', 'O']
    const placements = [
      ['0,0,0;0,0,1;1,0,0', '0,-1,1;1,-1,0;1,-1,1'],
    ]

    const buffer = buildTestBinary(pieceOrder, placements)
    const result = decodeSolutions(buffer)

    expect(result.placements[0][0]).toBe('0,0,0;0,0,1;1,0,0')
    expect(result.placements[0][1]).toBe('0,-1,1;1,-1,0;1,-1,1')
  })
})
