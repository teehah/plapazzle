import { useReducer, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import type { PuzzleDef } from '../core/puzzle'
import { initGameState, gameReducer } from '../game/state'
import type { GameState } from '../game/state'
import { getOrientedCells, getPlacedCells } from '../game/placement'
import { checkCleared } from '../game/clear-check'
import { BoardMesh } from '../three/BoardMesh'
import { PieceMesh } from '../three/PieceMesh'
import { Lighting } from '../three/Lighting'
import { SoundEngine } from '../audio/sound'
import type { Cell } from '../core/grid'

const CELL_SIZE = 30

const PIECE_COLORS: Record<string, string> = {
  I: '#e74c3c', O: '#3498db', X: '#2ecc71', C: '#f39c12',
  E: '#9b59b6', P: '#1abc9c', F: '#e67e22', V: '#34495e',
  S: '#e91e63', J: '#00bcd4', H: '#8bc34a', G: '#ff5722',
  L: '#ff6b6b', N: '#4ecdc4', T: '#45b7d1', U: '#96ceb4',
  W: '#ffeaa7', Y: '#dfe6e9', Z: '#a29bfe',
}

type Props = {
  puzzle: PuzzleDef
  soundEngine: SoundEngine
  onClear: (state: GameState, clearTimeMs: number) => void
}

export function GameScreen({ puzzle, soundEngine, onClear }: Props) {
  const [state, dispatch] = useReducer(gameReducer, puzzle, initGameState)
  const [elapsed, setElapsed] = useState(0)
  const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches

  // Start timer on mount
  useEffect(() => {
    if (!state.startedAt) {
      dispatch({ type: 'start', timestamp: Date.now() })
    }
  }, [state.startedAt])

  // Update elapsed time
  useEffect(() => {
    if (!state.startedAt) return
    const interval = setInterval(() => setElapsed(Date.now() - state.startedAt!), 100)
    return () => clearInterval(interval)
  }, [state.startedAt])

  // Check for clear
  useEffect(() => {
    const allCovered: Cell[] = []
    for (const ps of state.pieces) {
      if (ps.onBoard && ps.gridPosition) {
        const piece = puzzle.pieces.find(p => p.id === ps.pieceId)!
        const oriented = getOrientedCells(piece, ps.orientationIndex, ps.flipped, puzzle.gridType)
        const placed = getPlacedCells(oriented, ps.gridPosition)
        allCovered.push(...placed)
      }
    }
    if (checkCleared(puzzle.board, allCovered) && state.startedAt) {
      const clearTime = Date.now() - state.startedAt
      soundEngine.playFanfare()
      onClear(state, clearTime)
    }
  }, [state.pieces, puzzle, state.startedAt, soundEngine, onClear])

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  }

  return (
    <div style={{
      width: '100vw', height: '100dvh', position: 'relative',
      background: darkMode ? '#0a0a1a' : '#e8e0d8',
    }}>
      <div style={{
        position: 'absolute', top: 12, left: 16, zIndex: 10,
        color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
        fontSize: 16, fontFamily: 'monospace',
      }}>
        {formatTime(elapsed)}
      </div>
      <Canvas style={{ width: '100%', height: '100%' }}>
        <OrthographicCamera makeDefault position={[0, 0, 50]} zoom={2} />
        <Lighting darkMode={darkMode} />
        <BoardMesh cells={puzzle.board} cellSize={CELL_SIZE} gridType={puzzle.gridType} />
        {state.pieces.map((ps) => {
          const piece = puzzle.pieces.find(p => p.id === ps.pieceId)!
          const oriented = getOrientedCells(piece, ps.orientationIndex, ps.flipped, puzzle.gridType)
          const color = PIECE_COLORS[ps.pieceId] ?? '#888'
          return (
            <PieceMesh
              key={ps.pieceId}
              cells={oriented}
              cellSize={CELL_SIZE}
              gridType={puzzle.gridType}
              color={color}
              position={[ps.position.x, ps.position.y, 0]}
            />
          )
        })}
      </Canvas>
    </div>
  )
}
