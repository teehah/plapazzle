import { useReducer, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { PuzzleDef } from '../core/puzzle'
import { initGameState, gameReducer } from '../game/state'
import type { GameState } from '../game/state'
import { getOrientedCells, getPlacedCells, gridToWorld } from '../game/placement'
import { checkCleared } from '../game/clear-check'
import { findSnapPosition } from '../game/snap'
import { BoardMesh } from '../three/BoardMesh'
import { PieceMesh } from '../three/PieceMesh'
import { Lighting } from '../three/Lighting'
import { SoundEngine } from '../audio/sound'
import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { GRID_OPS } from '../core/grid-ops'

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
  soundEnabled: boolean
  onToggleSound: () => void
  onClear: (state: GameState, clearTimeMs: number) => void
}

/**
 * Compute board bounding box center in Three.js coords.
 * Mirrors the centering logic in BoardMesh for consistent alignment.
 */
function computeBoardOffset(board: Cell[], cellSize: number, gridType: GridType): { x: number; y: number } {
  const ops = GRID_OPS[gridType]
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const cell of board) {
    const pts = ops.cellToSvgPoints(cell, cellSize)
    for (const [px, py] of pts) {
      // Three.js coords: x = svg_x, y = -svg_y
      const tx = px
      const ty = -py
      if (tx < minX) minX = tx
      if (tx > maxX) maxX = tx
      if (ty < minY) minY = ty
      if (ty > maxY) maxY = ty
    }
  }
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  }
}

/**
 * Inner scene component that has access to Three.js camera/gl context.
 * Handles pointer events on the canvas for drag interactions.
 */
function SceneContent({
  children,
  onPointerMoveWorld,
  onPointerUpWorld,
}: {
  children: React.ReactNode
  onPointerMoveWorld: (worldX: number, worldY: number, clientX: number, clientY: number) => void
  onPointerUpWorld: (worldX: number, worldY: number) => void
}) {
  const { camera, gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement

    const handleMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
      const vec = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera)
      onPointerMoveWorld(vec.x, vec.y, e.clientX, e.clientY)
    }

    const handleUp = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
      const vec = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera)
      onPointerUpWorld(vec.x, vec.y)
    }

    canvas.addEventListener('pointermove', handleMove)
    canvas.addEventListener('pointerup', handleUp)
    return () => {
      canvas.removeEventListener('pointermove', handleMove)
      canvas.removeEventListener('pointerup', handleUp)
    }
  }, [camera, gl, onPointerMoveWorld, onPointerUpWorld])

  return <>{children}</>
}

export function GameScreen({ puzzle, soundEngine, soundEnabled, onToggleSound, onClear }: Props) {
  const [state, dispatch] = useReducer(gameReducer, puzzle, initGameState)
  const [elapsed, setElapsed] = useState(0)
  const [draggingPieceId, setDraggingPieceId] = useState<string | null>(null)
  const [dragStarted, setDragStarted] = useState(false)
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragWorldStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const pieceStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lastTapRef = useRef<{ pieceId: string; time: number }>({ pieceId: '', time: 0 })
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMobile = 'ontouchstart' in window
  const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches

  // Board offset: used to align piece positions with the centered board
  const boardOffset = useMemo(
    () => computeBoardOffset(puzzle.board, CELL_SIZE, puzzle.gridType),
    [puzzle],
  )

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

  // Cleanup tap timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current)
    }
  }, [])

  const handlePointerDown = useCallback(
    (pieceId: string, clientX: number, clientY: number) => {
      // If piece is on board, unsnap it first
      const ps = state.pieces.find(p => p.pieceId === pieceId)
      if (ps && ps.onBoard) {
        dispatch({
          type: 'unsnap',
          pieceId,
          position: ps.position,
          timestamp: Date.now(),
        })
      }
      setDraggingPieceId(pieceId)
      setDragStarted(false)
      dragStartPos.current = { x: clientX, y: clientY }
      if (ps) {
        pieceStartPos.current = { x: ps.position.x, y: ps.position.y }
      }
    },
    [state.pieces],
  )

  const handlePointerMoveWorld = useCallback(
    (worldX: number, worldY: number, clientX: number, clientY: number) => {
      if (!draggingPieceId) return

      const dx = clientX - dragStartPos.current.x
      const dy = clientY - dragStartPos.current.y
      const movedEnough = Math.abs(dx) > 5 || Math.abs(dy) > 5

      if (!dragStarted && movedEnough) {
        setDragStarted(true)
        // Record the world position at drag start for delta calculation
        dragWorldStart.current = { x: worldX, y: worldY }
      }

      if (dragStarted || movedEnough) {
        // Calculate delta from drag start in world coords
        const worldDx = worldX - dragWorldStart.current.x
        const worldDy = worldY - dragWorldStart.current.y

        let newX = pieceStartPos.current.x + worldDx
        let newY = pieceStartPos.current.y + worldDy

        // Mobile offset: shift piece 20 world units above finger
        if (isMobile) {
          newY += 20
        }

        dispatch({
          type: 'move',
          pieceId: draggingPieceId,
          position: { x: newX, y: newY },
          timestamp: Date.now(),
        })
      }
    },
    [draggingPieceId, dragStarted, isMobile],
  )

  const handlePointerUpWorld = useCallback(
    (_worldX: number, _worldY: number) => {
      if (!draggingPieceId) return

      if (!dragStarted) {
        // Tap logic
        const now = Date.now()
        const last = lastTapRef.current
        if (last.pieceId === draggingPieceId && now - last.time < 300) {
          // Double tap - flip
          if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current)
          tapTimeoutRef.current = null
          dispatch({ type: 'flip', pieceId: draggingPieceId, timestamp: now })
          soundEngine.playFlip()
          lastTapRef.current = { pieceId: '', time: 0 }
        } else {
          // Single tap - rotate (with delay for double-tap detection)
          lastTapRef.current = { pieceId: draggingPieceId, time: now }
          const pid = draggingPieceId
          tapTimeoutRef.current = setTimeout(() => {
            dispatch({ type: 'rotate', pieceId: pid, timestamp: Date.now() })
            soundEngine.playRotate()
            tapTimeoutRef.current = null
          }, 300)
        }
      } else {
        // Drag end - try snap
        const ps = state.pieces.find(p => p.pieceId === draggingPieceId)!
        const piece = puzzle.pieces.find(p => p.id === draggingPieceId)!
        const oriented = getOrientedCells(piece, ps.orientationIndex, ps.flipped, puzzle.gridType)

        // Get occupied cells from OTHER pieces on the board
        const occupied: Cell[] = []
        for (const other of state.pieces) {
          if (other.pieceId === draggingPieceId) continue
          if (other.onBoard && other.gridPosition) {
            const otherPiece = puzzle.pieces.find(p => p.id === other.pieceId)!
            const otherOriented = getOrientedCells(
              otherPiece,
              other.orientationIndex,
              other.flipped,
              puzzle.gridType,
            )
            occupied.push(...getPlacedCells(otherOriented, other.gridPosition))
          }
        }

        // Convert Three.js world position to SVG coordinates for snap detection.
        // SVG(sx,sy) -> Three.js geometry(sx,-sy) -> world(sx-boardOffset.x, -sy-boardOffset.y)
        // Inverse: sx = world.x + boardOffset.x, sy = -(world.y + boardOffset.y)
        const svgDropX = ps.position.x + boardOffset.x
        const svgDropY = -(ps.position.y + boardOffset.y)

        const snapPos = findSnapPosition(
          oriented,
          { x: svgDropX, y: svgDropY },
          puzzle.board,
          occupied,
          CELL_SIZE,
          puzzle.gridType,
        )

        if (snapPos) {
          // Calculate world position for snapped piece
          const placedCells = getPlacedCells(oriented, snapPos)
          const svgPositions = placedCells.map(c => gridToWorld(c, CELL_SIZE, puzzle.gridType))
          const svgCx = svgPositions.reduce((s, p) => s + p.x, 0) / svgPositions.length
          const svgCy = svgPositions.reduce((s, p) => s + p.y, 0) / svgPositions.length

          // Convert SVG centroid to Three.js world position (accounting for board centering)
          const worldX = svgCx - boardOffset.x
          const worldY = -svgCy - boardOffset.y

          dispatch({
            type: 'snap',
            pieceId: draggingPieceId,
            gridPosition: snapPos,
            worldPosition: { x: worldX, y: worldY },
            timestamp: Date.now(),
          })
          soundEngine.playSnap()
        }
        soundEngine.playClick()
      }

      setDraggingPieceId(null)
      setDragStarted(false)
    },
    [draggingPieceId, dragStarted, state.pieces, puzzle, soundEngine, boardOffset],
  )

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        position: 'relative',
        background: darkMode ? '#0a0a1a' : '#e8e0d8',
        touchAction: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 16,
          zIndex: 10,
          color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
          fontSize: 16,
          fontFamily: 'monospace',
        }}
      >
        {formatTime(elapsed)}
      </div>
      <div
        onClick={onToggleSound}
        style={{
          position: 'absolute', top: 12, right: 16, zIndex: 10,
          padding: '4px 12px', borderRadius: 12,
          background: soundEnabled ? 'rgba(100,200,255,0.15)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${soundEnabled ? 'rgba(100,200,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
          color: soundEnabled ? 'rgba(100,200,255,0.8)' : 'rgba(255,255,255,0.3)',
          fontSize: 12, cursor: 'pointer', userSelect: 'none',
        }}
      >
        {soundEnabled ? 'SOUND ON' : 'SOUND OFF'}
      </div>
      <Canvas style={{ width: '100%', height: '100%', touchAction: 'none' }}>
        <OrthographicCamera makeDefault position={[0, 0, 50]} zoom={2} />
        <Lighting darkMode={darkMode} />
        <SceneContent
          onPointerMoveWorld={handlePointerMoveWorld}
          onPointerUpWorld={handlePointerUpWorld}
        >
          <BoardMesh cells={puzzle.board} cellSize={CELL_SIZE} gridType={puzzle.gridType} />
          {state.pieces.map(ps => {
            const piece = puzzle.pieces.find(p => p.id === ps.pieceId)!
            const oriented = getOrientedCells(
              piece,
              ps.orientationIndex,
              ps.flipped,
              puzzle.gridType,
            )
            const color = PIECE_COLORS[ps.pieceId] ?? '#888'
            const isDragging = ps.pieceId === draggingPieceId
            const zPos = isDragging ? 5 : 0
            const scale = isDragging ? 1.2 : 1

            return (
              <PieceMesh
                key={ps.pieceId}
                cells={oriented}
                cellSize={CELL_SIZE}
                gridType={puzzle.gridType}
                color={color}
                position={[ps.position.x, ps.position.y, zPos]}
                scale={scale}
                onPointerDown={e => {
                  e.stopPropagation()
                  const nativeEvent = e.nativeEvent as PointerEvent
                  handlePointerDown(ps.pieceId, nativeEvent.clientX, nativeEvent.clientY)
                }}
              />
            )
          })}
        </SceneContent>
      </Canvas>
    </div>
  )
}
