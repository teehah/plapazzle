import { describe, it, expect } from 'vitest'
import { userPlacementToKeys, matchSolution } from '../solution-matching'
import type { SolutionData } from '../solution-loader'
import type { PuzzleDef } from '../../core/puzzle'
import type { PieceState } from '../state'
import type { Cell } from '../../core/grid'

// テスト用の正方形グリッドのパズル定義
function makeSquarePuzzle(): PuzzleDef {
  const board: Cell[] = []
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      board.push({ row: r, col: c, dir: 0 })
    }
  }
  return {
    id: 'test-4x4',
    name: 'Test 4x4',
    board,
    pieces: [
      {
        id: 'I',
        cells: [
          { row: 0, col: 0, dir: 0 },
          { row: 0, col: 1, dir: 0 },
          { row: 0, col: 2, dir: 0 },
          { row: 0, col: 3, dir: 0 },
        ],
      },
      {
        id: 'O',
        cells: [
          { row: 0, col: 0, dir: 0 },
          { row: 0, col: 1, dir: 0 },
          { row: 1, col: 0, dir: 0 },
          { row: 1, col: 1, dir: 0 },
        ],
      },
      {
        id: 'T',
        cells: [
          { row: 0, col: 0, dir: 0 },
          { row: 0, col: 1, dir: 0 },
          { row: 0, col: 2, dir: 0 },
          { row: 1, col: 1, dir: 0 },
        ],
      },
    ],
    gridType: 'square',
  }
}

function makePieceState(
  uid: string,
  pieceId: string,
  pieceIndex: number,
  orientationIndex: number,
  flipped: boolean,
  gridRow: number,
  gridCol: number,
): PieceState {
  return {
    uid,
    pieceId,
    pieceIndex,
    position: { x: 0, y: 0 },
    orientationIndex,
    flipped,
    onBoard: true,
    gridPosition: { row: gridRow, col: gridCol },
  }
}

describe('userPlacementToKeys', () => {
  it('should convert placed pieces to placement keys', () => {
    const puzzle = makeSquarePuzzle()
    // Place I-piece horizontally at row 0 (default orientation, no offset)
    const pieces: PieceState[] = [
      makePieceState('I_0', 'I', 0, 0, false, 0, 0),
    ]

    const keys = userPlacementToKeys(pieces, puzzle, 'square')

    expect(keys.has('I')).toBe(true)
    // I-piece at row 0: cells (0,0), (0,1), (0,2), (0,3)
    expect(keys.get('I')).toBe('0,0,0;0,1,0;0,2,0;0,3,0')
  })

  it('should skip pieces not on the board', () => {
    const puzzle = makeSquarePuzzle()
    const offBoardPiece: PieceState = {
      uid: 'I_0',
      pieceId: 'I',
      pieceIndex: 0,
      position: { x: 100, y: 100 },
      orientationIndex: 0,
      flipped: false,
      onBoard: false,
      gridPosition: null,
    }

    const keys = userPlacementToKeys([offBoardPiece], puzzle, 'square')
    expect(keys.size).toBe(0)
  })

  it('should merge cells for duplicate pieceIds', () => {
    // Simulate a puzzle with two copies of the same piece
    const puzzle: PuzzleDef = {
      id: 'test-dup',
      name: 'Test Dup',
      board: [],
      pieces: [
        {
          id: 'I',
          cells: [
            { row: 0, col: 0, dir: 0 },
            { row: 0, col: 1, dir: 0 },
          ],
        },
        {
          id: 'I',
          cells: [
            { row: 0, col: 0, dir: 0 },
            { row: 0, col: 1, dir: 0 },
          ],
        },
      ],
      gridType: 'square',
    }

    const pieces: PieceState[] = [
      makePieceState('I_0', 'I', 0, 0, false, 0, 0),
      makePieceState('I_1', 'I', 1, 0, false, 1, 0),
    ]

    const keys = userPlacementToKeys(pieces, puzzle, 'square')

    // Both I pieces merge under the same key
    expect(keys.has('I')).toBe(true)
    const cells = keys.get('I')!.split(';')
    // Should have 4 cells total (2 from each piece)
    expect(cells).toHaveLength(4)
  })
})

describe('matchSolution', () => {
  it('should return the matching solution index', () => {
    const data: SolutionData = {
      pieceOrder: ['A', 'B'],
      placements: [
        ['a1', 'b1'],
        ['a2', 'b2'],
        ['a3', 'b3'],
      ],
    }

    const userPlacement = new Map([
      ['A', 'a2'],
      ['B', 'b2'],
    ])

    expect(matchSolution(userPlacement, data)).toBe(1)
  })

  it('should return null when no match is found', () => {
    const data: SolutionData = {
      pieceOrder: ['A', 'B'],
      placements: [
        ['a1', 'b1'],
        ['a2', 'b2'],
      ],
    }

    const userPlacement = new Map([
      ['A', 'a1'],
      ['B', 'b2'],
    ])

    expect(matchSolution(userPlacement, data)).toBeNull()
  })

  it('should return the first match if multiple solutions match', () => {
    const data: SolutionData = {
      pieceOrder: ['A'],
      placements: [
        ['same'],
        ['same'],
      ],
    }

    const userPlacement = new Map([['A', 'same']])
    expect(matchSolution(userPlacement, data)).toBe(0)
  })

  it('should handle missing piece in user placement', () => {
    const data: SolutionData = {
      pieceOrder: ['A', 'B'],
      placements: [
        ['a1', 'b1'],
      ],
    }

    // User only placed piece A, B is missing
    const userPlacement = new Map([['A', 'a1']])

    // Missing piece gets '' which won't match 'b1'
    expect(matchSolution(userPlacement, data)).toBeNull()
  })

  it('should match with empty placements array', () => {
    const data: SolutionData = {
      pieceOrder: ['A'],
      placements: [],
    }

    const userPlacement = new Map([['A', 'a1']])
    expect(matchSolution(userPlacement, data)).toBeNull()
  })
})
