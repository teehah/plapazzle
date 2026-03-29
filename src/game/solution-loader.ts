/**
 * ナイーブバイナリ形式の解法データをデコードする。
 *
 * バイナリフォーマット:
 *   Header (7 bytes):
 *     magic: 4 bytes "SOLV"
 *     pieceCount: 1 byte (uint8)
 *     solutionCount: 2 bytes (uint16 LE)
 *   Piece order table:
 *     pieceCount × uint16 LE (string table index)
 *   Solution table:
 *     solutionCount × pieceCount × uint16 LE (string table index)
 *   String table:
 *     count: 2 bytes (uint16 LE)
 *     offsets: count × 4 bytes (uint32 LE)
 *     data: concatenated UTF-8 strings
 */

export type SolutionData = {
  pieceOrder: string[]
  placements: string[][] // [solutionIndex][pieceOrderIndex] = placement key
}

/**
 * ArrayBuffer からバイナリ解法データをデコードする。
 */
export function decodeSolutions(buffer: ArrayBuffer): SolutionData {
  const view = new DataView(buffer)
  let offset = 0

  // Header
  const magic =
    String.fromCharCode(view.getUint8(0)) +
    String.fromCharCode(view.getUint8(1)) +
    String.fromCharCode(view.getUint8(2)) +
    String.fromCharCode(view.getUint8(3))
  if (magic !== 'SOLV') {
    throw new Error(`Invalid magic: expected "SOLV", got "${magic}"`)
  }
  offset = 4

  const pieceCount = view.getUint8(offset)
  offset += 1

  const solutionCount = view.getUint16(offset, true)
  offset += 2

  // Piece order table (indices into string table)
  const pieceOrderIndices: number[] = []
  for (let i = 0; i < pieceCount; i++) {
    pieceOrderIndices.push(view.getUint16(offset, true))
    offset += 2
  }

  // Solution table (indices into string table)
  const solutionIndices: number[][] = []
  for (let s = 0; s < solutionCount; s++) {
    const row: number[] = []
    for (let p = 0; p < pieceCount; p++) {
      row.push(view.getUint16(offset, true))
      offset += 2
    }
    solutionIndices.push(row)
  }

  // String table
  const stringCount = view.getUint16(offset, true)
  offset += 2

  const stringOffsets: number[] = []
  for (let i = 0; i < stringCount; i++) {
    stringOffsets.push(view.getUint32(offset, true))
    offset += 4
  }

  // String data starts at current offset
  const dataStart = offset
  const decoder = new TextDecoder()

  function getString(index: number): string {
    const start = dataStart + stringOffsets[index]
    const end = index + 1 < stringCount
      ? dataStart + stringOffsets[index + 1]
      : buffer.byteLength
    return decoder.decode(new Uint8Array(buffer, start, end - start))
  }

  // Decode piece order
  const pieceOrder = pieceOrderIndices.map(getString)

  // Decode placements
  const placements: string[][] = solutionIndices.map(row =>
    row.map(getString),
  )

  return { pieceOrder, placements }
}

/**
 * 指定パズルの解法バイナリを fetch してデコードする。
 */
export async function loadSolutions(puzzleId: string): Promise<SolutionData> {
  const basePath = import.meta.env.BASE_URL ?? '/'
  const url = `${basePath}solutions/${puzzleId}.bin`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load solutions: ${response.status} ${response.statusText}`)
  }
  const buffer = await response.arrayBuffer()
  return decodeSolutions(buffer)
}
