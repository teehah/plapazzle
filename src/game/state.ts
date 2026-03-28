import type { PuzzleDef } from '../core/puzzle'
import type { GridType } from '../core/grid-ops'

export type Position = { x: number; y: number }
export type GridPosition = { row: number; col: number }

export type PieceState = {
  uid: string            // 一意識別子（pieceId + index）。同じIDのピースが複数ある場合に区別する。
  pieceId: string        // PieceDef.id（ピース種類）
  pieceIndex: number     // puzzle.pieces 配列内のインデックス
  position: Position
  orientationIndex: number
  flipped: boolean
  onBoard: boolean
  gridPosition: GridPosition | null
}

export type RecordedAction = {
  type: 'rotate' | 'flip' | 'move' | 'snap' | 'unsnap' | 'start'
  pieceId?: string
  position?: Position
  gridPosition?: GridPosition
  orientationIndex?: number
  timestamp: number
}

export type GameState = {
  puzzleId: string
  gridType: GridType
  pieces: PieceState[]
  actions: RecordedAction[]
  startedAt: number | null
}

export type GameAction =
  | { type: 'start'; timestamp: number }
  | { type: 'rotate'; uid: string; timestamp: number }
  | { type: 'flip'; uid: string; timestamp: number }
  | { type: 'move'; uid: string; position: Position; timestamp: number }
  | { type: 'snap'; uid: string; gridPosition: GridPosition; worldPosition: Position; timestamp: number }
  | { type: 'unsnap'; uid: string; position: Position; timestamp: number }

export function initGameState(puzzle: PuzzleDef): GameState {
  const pieces: PieceState[] = puzzle.pieces.map((p, i) => ({
    uid: `${p.id}_${i}`,
    pieceId: p.id,
    pieceIndex: i,
    position: { x: 0, y: 0 },
    orientationIndex: 0,
    flipped: false,
    onBoard: false,
    gridPosition: null,
  }))

  // Place pieces in a circle around the origin
  const radius = 250
  const angleStep = (2 * Math.PI) / pieces.length
  pieces.forEach((p, i) => {
    const angle = angleStep * i + (Math.random() - 0.5) * 0.8
    p.position = {
      x: Math.cos(angle) * (radius + Math.random() * 50),
      y: Math.sin(angle) * (radius + Math.random() * 50),
    }
  })

  return {
    puzzleId: puzzle.id,
    gridType: puzzle.gridType,
    pieces,
    actions: [],
    startedAt: null,
  }
}

function updatePiece(
  pieces: PieceState[],
  uid: string,
  updater: (p: PieceState) => PieceState,
): PieceState[] {
  return pieces.map(p => (p.uid === uid ? updater(p) : p))
}

function recordAction(action: GameAction): RecordedAction {
  switch (action.type) {
    case 'start':
      return { type: 'start', timestamp: action.timestamp }
    case 'rotate':
      return { type: 'rotate', pieceId: action.uid, timestamp: action.timestamp }
    case 'flip':
      return { type: 'flip', pieceId: action.uid, timestamp: action.timestamp }
    case 'move':
      return { type: 'move', pieceId: action.uid, position: action.position, timestamp: action.timestamp }
    case 'snap':
      return { type: 'snap', pieceId: action.uid, gridPosition: action.gridPosition, timestamp: action.timestamp }
    case 'unsnap':
      return { type: 'unsnap', pieceId: action.uid, position: action.position, timestamp: action.timestamp }
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const recorded = recordAction(action)
  const actions = [...state.actions, recorded]

  switch (action.type) {
    case 'start':
      return { ...state, startedAt: action.timestamp, actions }

    case 'rotate':
      return {
        ...state,
        pieces: updatePiece(state.pieces, action.uid, p => ({
          ...p,
          orientationIndex: p.orientationIndex + 1,
          onBoard: false,
          gridPosition: null,
        })),
        actions,
      }

    case 'flip':
      return {
        ...state,
        pieces: updatePiece(state.pieces, action.uid, p => ({
          ...p,
          flipped: !p.flipped,
          onBoard: false,
          gridPosition: null,
        })),
        actions,
      }

    case 'move':
      return {
        ...state,
        pieces: updatePiece(state.pieces, action.uid, p => ({
          ...p,
          position: action.position,
        })),
        actions,
      }

    case 'snap':
      return {
        ...state,
        pieces: updatePiece(state.pieces, action.uid, p => ({
          ...p,
          onBoard: true,
          gridPosition: action.gridPosition,
          position: action.worldPosition,
        })),
        actions,
      }

    case 'unsnap':
      return {
        ...state,
        pieces: updatePiece(state.pieces, action.uid, p => ({
          ...p,
          onBoard: false,
          gridPosition: null,
          position: action.position,
        })),
        actions,
      }
  }
}
