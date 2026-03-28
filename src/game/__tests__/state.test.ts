import { describe, it, expect } from 'vitest'
import { initGameState, gameReducer } from '../state'

const testPuzzle = {
  id: 'test',
  name: 'Test',
  board: [
    { row: 0, col: 0, dir: 0 as const },
    { row: 0, col: 1, dir: 0 as const },
  ],
  pieces: [
    { id: 'A', cells: [{ row: 0, col: 0, dir: 0 as const }] },
    { id: 'B', cells: [{ row: 0, col: 0, dir: 0 as const }] },
  ],
  gridType: 'square' as const,
}

describe('initGameState', () => {
  it('ピース数分のPieceStateを生成する', () => {
    const state = initGameState(testPuzzle)
    expect(state.pieces).toHaveLength(2)
  })

  it('各ピースの初期orientationは0', () => {
    const state = initGameState(testPuzzle)
    for (const p of state.pieces) {
      expect(p.orientationIndex).toBe(0)
    }
  })

  it('actionsは空配列', () => {
    const state = initGameState(testPuzzle)
    expect(state.actions).toEqual([])
  })

  it('startedAtはnull', () => {
    const state = initGameState(testPuzzle)
    expect(state.startedAt).toBeNull()
  })
})

describe('gameReducer', () => {
  it('rotate でorientationIndexが1増える', () => {
    const state = initGameState(testPuzzle)
    const next = gameReducer(state, { type: 'rotate', pieceId: 'A', timestamp: 100 })
    const pieceA = next.pieces.find(p => p.pieceId === 'A')!
    expect(pieceA.orientationIndex).toBe(1)
  })

  it('flip でflippedが反転する', () => {
    const state = initGameState(testPuzzle)
    const next = gameReducer(state, { type: 'flip', pieceId: 'A', timestamp: 100 })
    const pieceA = next.pieces.find(p => p.pieceId === 'A')!
    expect(pieceA.flipped).toBe(true)
  })

  it('move で位置が更新される', () => {
    const state = initGameState(testPuzzle)
    const next = gameReducer(state, { type: 'move', pieceId: 'A', position: { x: 50, y: 100 }, timestamp: 100 })
    const pieceA = next.pieces.find(p => p.pieceId === 'A')!
    expect(pieceA.position).toEqual({ x: 50, y: 100 })
  })

  it('snap でonBoardがtrueになりgridPositionが設定される', () => {
    const state = initGameState(testPuzzle)
    const next = gameReducer(state, {
      type: 'snap', pieceId: 'A', gridPosition: { row: 0, col: 0 },
      worldPosition: { x: 10, y: 20 }, timestamp: 100,
    })
    const pieceA = next.pieces.find(p => p.pieceId === 'A')!
    expect(pieceA.onBoard).toBe(true)
    expect(pieceA.gridPosition).toEqual({ row: 0, col: 0 })
  })

  it('アクションがactionsに記録される', () => {
    const state = initGameState(testPuzzle)
    const next = gameReducer(state, { type: 'rotate', pieceId: 'A', timestamp: 100 })
    expect(next.actions).toHaveLength(1)
    expect(next.actions[0].type).toBe('rotate')
  })

  it('start でstartedAtが設定される', () => {
    const state = initGameState(testPuzzle)
    const next = gameReducer(state, { type: 'start', timestamp: 1000 })
    expect(next.startedAt).toBe(1000)
  })

  it('unsnap でonBoardがfalseになる', () => {
    let state = initGameState(testPuzzle)
    state = gameReducer(state, {
      type: 'snap', pieceId: 'A', gridPosition: { row: 0, col: 0 },
      worldPosition: { x: 10, y: 20 }, timestamp: 100,
    })
    state = gameReducer(state, {
      type: 'unsnap', pieceId: 'A', position: { x: 50, y: 50 }, timestamp: 200,
    })
    const pieceA = state.pieces.find(p => p.pieceId === 'A')!
    expect(pieceA.onBoard).toBe(false)
    expect(pieceA.gridPosition).toBeNull()
  })
})
