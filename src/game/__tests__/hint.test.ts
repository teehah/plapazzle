import { describe, it, expect } from 'vitest'
import {
  findCompatibleSolutions,
  getHint,
  findPlacement,
  parsePlacementKey,
} from '../hint'
import type { SolutionData } from '../solution-loader'
import type { PuzzleDef } from '../../core/puzzle'
import type { PieceState } from '../state'
import type { Cell } from '../../core/grid'

// --- テスト用ヘルパー ---

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
        id: 'A',
        cells: [
          { row: 0, col: 0, dir: 0 },
          { row: 0, col: 1, dir: 0 },
          { row: 0, col: 2, dir: 0 },
          { row: 0, col: 3, dir: 0 },
        ],
      },
      {
        id: 'B',
        cells: [
          { row: 0, col: 0, dir: 0 },
          { row: 0, col: 1, dir: 0 },
          { row: 1, col: 0, dir: 0 },
          { row: 1, col: 1, dir: 0 },
        ],
      },
      {
        id: 'C',
        cells: [
          { row: 0, col: 0, dir: 0 },
          { row: 0, col: 1, dir: 0 },
          { row: 0, col: 2, dir: 0 },
          { row: 1, col: 1, dir: 0 },
        ],
      },
      {
        id: 'D',
        cells: [
          { row: 0, col: 0, dir: 0 },
          { row: 0, col: 1, dir: 0 },
          { row: 0, col: 2, dir: 0 },
          { row: 0, col: 3, dir: 0 },
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

function makeOffBoardPiece(uid: string, pieceId: string, pieceIndex: number): PieceState {
  return {
    uid,
    pieceId,
    pieceIndex,
    position: { x: 100, y: 100 },
    orientationIndex: 0,
    flipped: false,
    onBoard: false,
    gridPosition: null,
  }
}

// --- parsePlacementKey テスト ---

describe('parsePlacementKey', () => {
  it('should parse a placement key into cells', () => {
    const cells = parsePlacementKey('0,0,0;0,1,0;1,0,0;1,1,0')
    expect(cells).toEqual([
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
      { row: 1, col: 0, dir: 0 },
      { row: 1, col: 1, dir: 0 },
    ])
  })

  it('should return empty array for empty string', () => {
    expect(parsePlacementKey('')).toEqual([])
  })

  it('should handle cells with dir=1', () => {
    const cells = parsePlacementKey('0,0,0;0,0,1')
    expect(cells).toEqual([
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 0, dir: 1 },
    ])
  })
})

// --- findCompatibleSolutions テスト ---

describe('findCompatibleSolutions', () => {
  it('should return all solutions when no pieces are placed', () => {
    const puzzle = makeSquarePuzzle()
    const data: SolutionData = {
      pieceOrder: ['A', 'B', 'C', 'D'],
      placements: [
        ['a1', 'b1', 'c1', 'd1'],
        ['a2', 'b2', 'c2', 'd2'],
        ['a3', 'b3', 'c3', 'd3'],
      ],
    }

    const pieces: PieceState[] = [
      makeOffBoardPiece('A_0', 'A', 0),
      makeOffBoardPiece('B_0', 'B', 1),
    ]

    const result = findCompatibleSolutions(pieces, puzzle, 'square', data)
    expect(result).toEqual([0, 1, 2])
  })

  it('should filter to solutions matching placed pieces', () => {
    const puzzle = makeSquarePuzzle()
    // A-piece の cells は [0,0], [0,1], [0,2], [0,3] を direction 0 で orientation 0
    // pieceIndex 0、orientation 0 => row 0 の 4 セルを占有する
    // gridPosition {row: 0, col: 0} → cells: (0,0), (0,1), (0,2), (0,3)
    // cellKey = "0,0,0;0,1,0;0,2,0;0,3,0"
    const data: SolutionData = {
      pieceOrder: ['A', 'B'],
      placements: [
        ['0,0,0;0,1,0;0,2,0;0,3,0', 'b1'],
        ['1,0,0;1,1,0;1,2,0;1,3,0', 'b2'],
        ['0,0,0;0,1,0;0,2,0;0,3,0', 'b3'],
      ],
    }

    const pieces: PieceState[] = [
      makePieceState('A_0', 'A', 0, 0, false, 0, 0),
    ]

    const result = findCompatibleSolutions(pieces, puzzle, 'square', data)
    // A at row 0 matches solutions 0 and 2
    expect(result).toEqual([0, 2])
  })

  it('should return empty when no solutions match', () => {
    const puzzle = makeSquarePuzzle()
    const data: SolutionData = {
      pieceOrder: ['A', 'B'],
      placements: [
        ['x', 'y'],
        ['z', 'w'],
      ],
    }

    const pieces: PieceState[] = [
      makePieceState('A_0', 'A', 0, 0, false, 0, 0),
    ]

    const result = findCompatibleSolutions(pieces, puzzle, 'square', data)
    expect(result).toEqual([])
  })
})

// --- getHint テスト ---

describe('getHint', () => {
  it('should suggest an unplaced piece', () => {
    const puzzle = makeSquarePuzzle()
    const data: SolutionData = {
      pieceOrder: ['A', 'B'],
      placements: [
        ['0,0,0;0,1,0;0,2,0;0,3,0', '1,0,0;1,1,0;2,0,0;2,1,0'],
      ],
    }

    const pieces: PieceState[] = [
      makePieceState('A_0', 'A', 0, 0, false, 0, 0),
      makeOffBoardPiece('B_0', 'B', 1),
    ]

    const compatible = [0]
    const hint = getHint(compatible, pieces, puzzle, 'square', data)

    expect(hint).not.toBeNull()
    expect(hint!.pieceId).toBe('B')
    expect(hint!.cells).toHaveLength(4)
    expect(hint!.solutionIndex).toBe(0)
  })

  it('should return null when no compatible solutions exist', () => {
    const puzzle = makeSquarePuzzle()
    const data: SolutionData = {
      pieceOrder: ['A'],
      placements: [],
    }

    const result = getHint([], [], puzzle, 'square', data)
    expect(result).toBeNull()
  })

  it('should prefer pieces adjacent to placed pieces', () => {
    const puzzle = makeSquarePuzzle()
    // Piece A is at row 0, cols 0-3
    // Piece B touches A (rows 1-2, cols 0-1) -- adjacent
    // Piece C is far (row 3) -- not adjacent
    const data: SolutionData = {
      pieceOrder: ['A', 'B', 'C'],
      placements: [
        [
          '0,0,0;0,1,0;0,2,0;0,3,0',
          '1,0,0;1,1,0;2,0,0;2,1,0',
          '3,0,0;3,1,0;3,2,0;3,3,0',
        ],
      ],
    }

    const pieces: PieceState[] = [
      makePieceState('A_0', 'A', 0, 0, false, 0, 0),
      makeOffBoardPiece('B_0', 'B', 1),
      makeOffBoardPiece('C_0', 'C', 2),
    ]

    const hint = getHint([0], pieces, puzzle, 'square', data)
    expect(hint).not.toBeNull()
    // B is adjacent to A, so should be preferred over C
    expect(hint!.pieceId).toBe('B')
  })

  it('should return first piece when nothing is placed', () => {
    const puzzle = makeSquarePuzzle()
    const data: SolutionData = {
      pieceOrder: ['A', 'B'],
      placements: [
        ['a', 'b'],
      ],
    }

    const pieces: PieceState[] = [
      makeOffBoardPiece('A_0', 'A', 0),
      makeOffBoardPiece('B_0', 'B', 1),
    ]

    const hint = getHint([0], pieces, puzzle, 'square', data)
    expect(hint).not.toBeNull()
    expect(hint!.pieceId).toBe('A')
  })
})

// --- findPlacement テスト ---

describe('findPlacement', () => {
  it('should find the correct orientation and position for a target placement', () => {
    const board: Cell[] = []
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        board.push({ row: r, col: c, dir: 0 })
      }
    }

    // I-piece (4 cells in a row)
    const pieceDef = {
      id: 'I',
      cells: [
        { row: 0, col: 0, dir: 0 as const },
        { row: 0, col: 1, dir: 0 as const },
        { row: 0, col: 2, dir: 0 as const },
        { row: 0, col: 3, dir: 0 as const },
      ],
    }

    // Target: I-piece at row 2
    const targetCells: Cell[] = [
      { row: 2, col: 0, dir: 0 },
      { row: 2, col: 1, dir: 0 },
      { row: 2, col: 2, dir: 0 },
      { row: 2, col: 3, dir: 0 },
    ]

    const result = findPlacement(pieceDef, targetCells, board, 'square')
    expect(result).not.toBeNull()
    expect(result!.gridPosition).toEqual({ row: 2, col: 0 })
  })

  it('should return null when no valid placement exists', () => {
    const board: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
    ]

    const pieceDef = {
      id: 'Big',
      cells: [
        { row: 0, col: 0, dir: 0 as const },
        { row: 0, col: 1, dir: 0 as const },
        { row: 0, col: 2, dir: 0 as const },
      ],
    }

    // Target is outside the board
    const targetCells: Cell[] = [
      { row: 5, col: 5, dir: 0 },
      { row: 5, col: 6, dir: 0 },
      { row: 5, col: 7, dir: 0 },
    ]

    const result = findPlacement(pieceDef, targetCells, board, 'square')
    expect(result).toBeNull()
  })

  it('should find a rotated orientation', () => {
    const board: Cell[] = []
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        board.push({ row: r, col: c, dir: 0 })
      }
    }

    // I-piece: horizontal by default
    const pieceDef = {
      id: 'I',
      cells: [
        { row: 0, col: 0, dir: 0 as const },
        { row: 0, col: 1, dir: 0 as const },
        { row: 0, col: 2, dir: 0 as const },
        { row: 0, col: 3, dir: 0 as const },
      ],
    }

    // Target: vertical I-piece (rotated 90deg)
    const targetCells: Cell[] = [
      { row: 0, col: 1, dir: 0 },
      { row: 1, col: 1, dir: 0 },
      { row: 2, col: 1, dir: 0 },
      { row: 3, col: 1, dir: 0 },
    ]

    const result = findPlacement(pieceDef, targetCells, board, 'square')
    expect(result).not.toBeNull()
    // Should find some orientation that produces vertical placement
    // Verify by checking gridPosition is correct
    expect(result!.gridPosition.col).toBe(1)
  })
})
