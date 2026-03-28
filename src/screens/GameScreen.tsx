import { useReducer, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { PuzzleDef } from '../core/puzzle'
import { initGameState, gameReducer } from '../game/state'
import type { GameState } from '../game/state'
import { getOrientedCells, getPlacedCells } from '../game/placement'
import { checkCleared } from '../game/clear-check'
import { findSnapPosition } from '../game/snap'
import { worldToSvgDrop, svgSnapToWorld } from '../game/coords'
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
/**
 * 画面座標 → Three.js ワールド座標変換（OrthographicCamera用）
 */
function screenToWorld(
  clientX: number, clientY: number,
  camera: THREE.Camera, canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1
  const vec = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera)
  return { x: vec.x, y: vec.y }
}

function SceneContent({
  children,
  onPointerDownWorld,
  onPointerMoveWorld,
  onPointerUpWorld,
}: {
  children: React.ReactNode
  onPointerDownWorld: (worldX: number, worldY: number, clientX: number, clientY: number) => void
  onPointerMoveWorld: (worldX: number, worldY: number, clientX: number, clientY: number) => void
  onPointerUpWorld: () => void
}) {
  const { camera, gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement

    const handleDown = (e: PointerEvent) => {
      const w = screenToWorld(e.clientX, e.clientY, camera, canvas)
      onPointerDownWorld(w.x, w.y, e.clientX, e.clientY)
    }

    const handleMove = (e: PointerEvent) => {
      const w = screenToWorld(e.clientX, e.clientY, camera, canvas)
      onPointerMoveWorld(w.x, w.y, e.clientX, e.clientY)
    }

    const handleUp = () => {
      onPointerUpWorld()
    }

    canvas.addEventListener('pointerdown', handleDown)
    canvas.addEventListener('pointermove', handleMove)
    canvas.addEventListener('pointerup', handleUp)
    return () => {
      canvas.removeEventListener('pointerdown', handleDown)
      canvas.removeEventListener('pointermove', handleMove)
      canvas.removeEventListener('pointerup', handleUp)
    }
  }, [camera, gl, onPointerDownWorld, onPointerMoveWorld, onPointerUpWorld])

  return <>{children}</>
}

export function GameScreen({ puzzle, soundEngine, soundEnabled, onToggleSound, onClear }: Props) {
  const [state, dispatch] = useReducer(gameReducer, puzzle, initGameState)
  const [elapsed, setElapsed] = useState(0)
  // ドラッグ状態は ref で同期管理（イベントハンドラ用）
  // state はレンダリング用（z-index 表示切替）
  const [draggingPieceId, setDraggingPieceId] = useState<string | null>(null)
  const draggingRef = useRef<string | null>(null)
  const dragStartedRef = useRef(false)
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

  // PieceMesh の onPointerDown で pieceId を記録（R3F の raycast で hit 判定）
  const pendingPieceRef = useRef<string | null>(null)

  const handlePiecePointerDown = useCallback((pieceId: string) => {
    pendingPieceRef.current = pieceId
  }, [])

  // SceneContent の pointerdown で全座標変換を統一的に処理
  const handlePointerDownWorld = useCallback(
    (worldX: number, worldY: number, clientX: number, clientY: number) => {
      const pieceId = pendingPieceRef.current
      pendingPieceRef.current = null
      if (!pieceId) return

      const ps = state.pieces.find(p => p.pieceId === pieceId)
      if (!ps) return

      if (ps.onBoard) {
        dispatch({
          type: 'unsnap',
          pieceId,
          position: ps.position,
          timestamp: Date.now(),
        })
      }
      draggingRef.current = pieceId
      dragStartedRef.current = false
      setDraggingPieceId(pieceId)
      dragStartPos.current = { x: clientX, y: clientY }
      dragWorldStart.current = { x: worldX, y: worldY }
      pieceStartPos.current = { x: ps.position.x, y: ps.position.y }
    },
    [state.pieces],
  )

  const handlePointerMoveWorld = useCallback(
    (worldX: number, worldY: number, clientX: number, clientY: number) => {
      const pid = draggingRef.current
      if (!pid) return

      const dx = clientX - dragStartPos.current.x
      const dy = clientY - dragStartPos.current.y
      const movedEnough = Math.abs(dx) > 5 || Math.abs(dy) > 5

      if (!dragStartedRef.current && movedEnough) {
        dragStartedRef.current = true
      }

      if (dragStartedRef.current) {
        const worldDx = worldX - dragWorldStart.current.x
        const worldDy = worldY - dragWorldStart.current.y

        let newX = pieceStartPos.current.x + worldDx
        let newY = pieceStartPos.current.y + worldDy

        if (isMobile) {
          newY += 20
        }

        dispatch({
          type: 'move',
          pieceId: pid,
          position: { x: newX, y: newY },
          timestamp: Date.now(),
        })
      }
    },
    [isMobile],
  )

  const handlePointerUpWorld = useCallback(
    () => {
      const pid = draggingRef.current
      if (!pid) return

      // 同期的にクリア — 後続の pointermove が move を dispatch しないようにする
      const wasDrag = dragStartedRef.current
      draggingRef.current = null
      dragStartedRef.current = false
      setDraggingPieceId(null)

      if (!wasDrag) {
        // タップ判定
        const now = Date.now()
        const last = lastTapRef.current
        if (last.pieceId === pid && now - last.time < 300) {
          if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current)
          tapTimeoutRef.current = null
          dispatch({ type: 'flip', pieceId: pid, timestamp: now })
          soundEngine.playFlip()
          lastTapRef.current = { pieceId: '', time: 0 }
        } else {
          lastTapRef.current = { pieceId: pid, time: now }
          tapTimeoutRef.current = setTimeout(() => {
            dispatch({ type: 'rotate', pieceId: pid, timestamp: Date.now() })
            soundEngine.playRotate()
            tapTimeoutRef.current = null
          }, 300)
        }
      } else {
        // ドラッグ終了 — スナップ判定
        const ps = state.pieces.find(p => p.pieceId === pid)!
        const piece = puzzle.pieces.find(p => p.id === pid)!
        const oriented = getOrientedCells(piece, ps.orientationIndex, ps.flipped, puzzle.gridType)

        const occupied: Cell[] = []
        for (const other of state.pieces) {
          if (other.pieceId === pid) continue
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

        const svgDrop = worldToSvgDrop(
          ps.position, oriented, CELL_SIZE, puzzle.gridType, boardOffset,
        )

        const snapPos = findSnapPosition(
          oriented, svgDrop, puzzle.board, occupied, CELL_SIZE, puzzle.gridType,
        )

        if (snapPos) {
          const worldPos = svgSnapToWorld(
            oriented, snapPos, CELL_SIZE, puzzle.gridType, boardOffset,
          )
          dispatch({
            type: 'snap', pieceId: pid,
            gridPosition: snapPos, worldPosition: worldPos,
            timestamp: Date.now(),
          })
          soundEngine.playSnap()
        }
      }
    },
    [state.pieces, puzzle, soundEngine, boardOffset],
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
          onPointerDownWorld={handlePointerDownWorld}
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

            return (
              <PieceMesh
                key={ps.pieceId}
                cells={oriented}
                cellSize={CELL_SIZE}
                gridType={puzzle.gridType}
                color={color}
                position={[ps.position.x, ps.position.y, zPos]}
                scale={1}
                onPointerDown={e => {
                  e.stopPropagation()
                  handlePiecePointerDown(ps.pieceId)
                }}
              />
            )
          })}
        </SceneContent>
      </Canvas>
    </div>
  )
}
