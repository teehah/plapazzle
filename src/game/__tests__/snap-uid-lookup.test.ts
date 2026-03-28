/**
 * テトロミノのスナップパスで uid → piece 定義の参照が正しく動くことを検証。
 *
 * 以前のバグ: puzzle.pieces.find(p => p.id === uid) は uid="I_0" vs id="I" で
 * 不一致 → undefined → TypeError でスナップが無条件に失敗していた。
 *
 * 修正: puzzle.pieces[ps.pieceIndex] で直接インデックス参照。
 */
import { describe, it, expect } from 'vitest'
import { PUZZLES } from '../../data/puzzles'
import { initGameState } from '../state'
import { getOrientedCells, getPlacedCells } from '../placement'
import { worldToSvgDrop, svgSnapToWorld } from '../coords'
import { findSnapPosition } from '../snap'
import type { Cell } from '../../core/grid'
import { GRID_OPS } from '../../core/grid-ops'

const CELL_SIZE = 30

function computeBoardOffset(board: Cell[], cellSize: number, gridType: 'square' | 'triangular') {
  const ops = GRID_OPS[gridType]
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const cell of board) {
    const pts = ops.cellToSvgPoints(cell, cellSize)
    for (const [px, py] of pts) {
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (-py < minY) minY = -py
      if (-py > maxY) maxY = -py
    }
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}

describe('snap uid lookup (テトロミノ)', () => {
  const puzzle = PUZZLES.find(p => p.id === 'tetromino-5x8')!

  it('テトロミノパズルが存在する', () => {
    expect(puzzle).toBeDefined()
    expect(puzzle.pieces.length).toBe(10)
  })

  it('全ピースの uid が一意である', () => {
    const state = initGameState(puzzle)
    const uids = state.pieces.map(p => p.uid)
    expect(new Set(uids).size).toBe(uids.length)
  })

  it('uid から pieceIndex 経由で正しいピース定義を取得できる', () => {
    const state = initGameState(puzzle)
    for (const ps of state.pieces) {
      const piece = puzzle.pieces[ps.pieceIndex]
      expect(piece).toBeDefined()
      expect(piece.id).toBe(ps.pieceId)
      expect(piece.cells.length).toBeGreaterThan(0)
    }
  })

  it('各ピースをボード中央にドロップするとスナップする', () => {
    const state = initGameState(puzzle)
    const boardOffset = computeBoardOffset(puzzle.board, CELL_SIZE, puzzle.gridType)

    // ボード中央の SVG 座標を計算
    const ops = GRID_OPS[puzzle.gridType]
    let sumX = 0, sumY = 0
    for (const cell of puzzle.board) {
      const pts = ops.cellToSvgPoints(cell, CELL_SIZE)
      const cx = pts.reduce((s: number, p: number[]) => s + p[0], 0) / pts.length
      const cy = pts.reduce((s: number, p: number[]) => s + p[1], 0) / pts.length
      sumX += cx
      sumY += cy
    }
    const boardCenterSvg = { x: sumX / puzzle.board.length, y: sumY / puzzle.board.length }

    // 各ピースをボード中央にドロップしてスナップを試す（1つずつ、占有なし）
    for (const ps of state.pieces) {
      const piece = puzzle.pieces[ps.pieceIndex]
      const oriented = getOrientedCells(piece, ps.orientationIndex, ps.flipped, puzzle.gridType)

      // ピースの mesh position をボード中央に相当するワールド座標にする
      const worldPos = {
        x: boardCenterSvg.x - boardOffset.x,
        y: -boardCenterSvg.y - boardOffset.y,
      }

      const svgDrop = worldToSvgDrop(worldPos, oriented, CELL_SIZE, puzzle.gridType, boardOffset)
      const snapPos = findSnapPosition(oriented, svgDrop, puzzle.board, [], CELL_SIZE, puzzle.gridType)

      expect(snapPos).not.toBeNull()

      // スナップ後のワールド座標も計算できる
      if (snapPos) {
        const snapWorld = svgSnapToWorld(oriented, snapPos, CELL_SIZE, puzzle.gridType, boardOffset)
        expect(typeof snapWorld.x).toBe('number')
        expect(typeof snapWorld.y).toBe('number')
        expect(isNaN(snapWorld.x)).toBe(false)
        expect(isNaN(snapWorld.y)).toBe(false)
      }
    }
  })

  it('重複 id のピース（I_0 と I_5）が別々にスナップできる', () => {
    const state = initGameState(puzzle)
    const boardOffset = computeBoardOffset(puzzle.board, CELL_SIZE, puzzle.gridType)

    // I ピース2つを取得
    const iPieces = state.pieces.filter(p => p.pieceId === 'I')
    expect(iPieces.length).toBe(2)
    expect(iPieces[0].uid).not.toBe(iPieces[1].uid)

    // 1つ目をスナップ
    const ps1 = iPieces[0]
    const piece1 = puzzle.pieces[ps1.pieceIndex]
    const oriented1 = getOrientedCells(piece1, 0, false, puzzle.gridType)

    // ボード左上付近にドロップ
    const dropSvg1 = { x: CELL_SIZE * 1.5, y: CELL_SIZE * 0.5 }
    const snap1 = findSnapPosition(oriented1, dropSvg1, puzzle.board, [], CELL_SIZE, puzzle.gridType)
    expect(snap1).not.toBeNull()

    // 1つ目の占有セルを計算
    const occupied = getPlacedCells(oriented1, snap1!)

    // 2つ目を別の位置にスナップ（1つ目の占有セルを避ける）
    const ps2 = iPieces[1]
    const piece2 = puzzle.pieces[ps2.pieceIndex]
    const oriented2 = getOrientedCells(piece2, 0, false, puzzle.gridType)

    const dropSvg2 = { x: CELL_SIZE * 1.5, y: CELL_SIZE * 1.5 }
    const snap2 = findSnapPosition(oriented2, dropSvg2, puzzle.board, occupied, CELL_SIZE, puzzle.gridType)
    expect(snap2).not.toBeNull()

    // 2つのスナップ位置が異なる
    if (snap1 && snap2) {
      expect(snap1.row !== snap2.row || snap1.col !== snap2.col).toBe(true)
    }
  })
})
