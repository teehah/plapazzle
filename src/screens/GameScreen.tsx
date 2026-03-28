import { useReducer, useEffect, useState, useRef, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { PuzzleDef } from '../core/puzzle'
import type { Cell } from '../core/grid'
import { initGameState, gameReducer } from '../game/state'
import type { GameState } from '../game/state'
import { getOrientedCells, getPlacedCells } from '../game/placement'
import { checkCleared } from '../game/clear-check'
import { findSnapPosition } from '../game/snap'
import { worldToSvgDrop, svgSnapToWorld } from '../game/coords'
import { geometryCenteringOffset } from '../game/bbox'
import {
  type Rect,
  computeBoardWorldBbox,
  computePieceWorldBbox,
  pushOutOfObstacles,
  hasObstacleOverlap,
  clampToViewport,
} from '../game/collision'
import { BoardMesh } from '../three/BoardMesh'
import { PieceMesh } from '../three/PieceMesh'
import { Lighting } from '../three/Lighting'
import { SoundEngine } from '../audio/sound'
import { formatTime } from '../utils/format'

const CELL_SIZE = 30

const PIECE_PALETTE = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
  '#e91e63', '#00bcd4', '#8bc34a', '#ff5722',
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
  '#ffeaa7', '#a29bfe', '#fd79a8', '#636e72',
]

type Props = {
  puzzle: PuzzleDef
  soundEngine: SoundEngine
  soundEnabled: boolean
  onToggleSound: () => void
  onClear: (state: GameState, clearTimeMs: number) => void
}

/**
 * 現在ボード上に配置されている全ピースが占有するセルを集める。
 * excludeUid を指定すると、そのピースを除外する。
 */
function collectOccupiedCells(
  puzzle: PuzzleDef,
  pieces: GameState['pieces'],
  excludeUid?: string,
): Cell[] {
  const occupied: Cell[] = []
  for (const ps of pieces) {
    if (ps.uid === excludeUid) continue
    if (ps.onBoard && ps.gridPosition) {
      const piece = puzzle.pieces[ps.pieceIndex]
      const oriented = getOrientedCells(piece, ps.orientationIndex, ps.flipped, puzzle.gridType)
      occupied.push(...getPlacedCells(oriented, ps.gridPosition))
    }
  }
  return occupied
}

/**
 * 画面座標 → Three.js ワールド座標（OrthographicCamera）
 */
function screenToWorld(
  clientX: number, clientY: number,
  camera: THREE.Camera, domElement: HTMLElement,
): { x: number; y: number } {
  const rect = domElement.getBoundingClientRect()
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1
  const vec = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera)
  return { x: vec.x, y: vec.y }
}

/**
 * ボードサイズに合わせてカメラ zoom を自動調整する。
 */
function AutoZoomCamera({ boardBbox }: { boardBbox: Rect }) {
  const { size } = useThree()

  const worldW = (boardBbox.maxX - boardBbox.minX) * 2.2
  const worldH = (boardBbox.maxY - boardBbox.minY) * 2.2

  const zoom = Math.min(size.width / worldW, size.height / worldH)

  return <OrthographicCamera makeDefault position={[0, 0, 50]} zoom={zoom} />
}

/**
 * 全イベントを canvas DOM リスナーで処理する内部コンポーネント。
 */
function Scene({
  puzzle,
  state,
  dispatch,
  boardOffset,
  boardBbox,
  soundEngine,
  isMobile,
  darkMode,
  draggingPieceId,
  setDraggingPieceId,
}: {
  puzzle: PuzzleDef
  state: GameState
  dispatch: React.Dispatch<any>
  boardOffset: { x: number; y: number }
  boardBbox: Rect
  soundEngine: SoundEngine
  isMobile: boolean
  darkMode: boolean
  draggingPieceId: string | null
  setDraggingPieceId: (id: string | null) => void
}) {
  const { camera, gl, viewport } = useThree()
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  const draggingRef = useRef<string | null>(null)
  const dragStartedRef = useRef(false)
  const wasOnBoardRef = useRef(false)
  const dragStartClient = useRef({ x: 0, y: 0 })
  const dragStartWorld = useRef({ x: 0, y: 0 })
  const pieceStartPos = useRef({ x: 0, y: 0 })
  const lastTapRef = useRef({ uid: '', time: 0 })
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pieceMeshMap = useRef<Map<string, THREE.Object3D>>(new Map())

  const stateRef = useRef(state)
  stateRef.current = state

  function findPieceAtScreen(clientX: number, clientY: number): string | null {
    const rect = gl.domElement.getBoundingClientRect()
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)

    const pieceMeshes = Array.from(pieceMeshMap.current.values())
    pieceMeshes.forEach(obj => obj.updateWorldMatrix(true, true))
    const intersects = raycaster.intersectObjects(pieceMeshes, true)
    if (intersects.length === 0) return null

    let obj: THREE.Object3D | null = intersects[0].object
    while (obj) {
      if (obj.userData.uid) return obj.userData.uid as string
      obj = obj.parent
    }
    return null
  }

  /**
   * ドラッグ終了時のスナップ判定を行う。
   * スナップしなかった場合は障害物回避とビューポートクランプを適用する。
   */
  function handleDropSnap(pid: string): void {
    const currentState = stateRef.current
    const ps = currentState.pieces.find(p => p.uid === pid)!
    const piece = puzzle.pieces[ps.pieceIndex]
    const oriented = getOrientedCells(piece, ps.orientationIndex, ps.flipped, puzzle.gridType)

    const occupied = collectOccupiedCells(puzzle, currentState.pieces, pid)
    const svgDrop = worldToSvgDrop(ps.position, oriented, CELL_SIZE, puzzle.gridType, boardOffset)
    const snapPos = findSnapPosition(oriented, svgDrop, puzzle.board, occupied, CELL_SIZE, puzzle.gridType)

    if (snapPos) {
      const worldPos = svgSnapToWorld(oriented, snapPos, CELL_SIZE, puzzle.gridType, boardOffset)
      dispatch({ type: 'snap', uid: pid, gridPosition: snapPos, worldPosition: worldPos, timestamp: Date.now() })
      soundEngine.playSnap()
      return
    }

    // スナップしなかった場合、ボード・他ピースとの重なりを解消
    const obstacles: Rect[] = [boardBbox]
    for (const other of currentState.pieces) {
      if (other.uid === pid || other.onBoard) continue
      const otherPiece = puzzle.pieces[other.pieceIndex]
      const otherOriented = getOrientedCells(otherPiece, other.orientationIndex, other.flipped, puzzle.gridType)
      obstacles.push(computePieceWorldBbox(otherOriented, CELL_SIZE, puzzle.gridType, other.position))
    }

    let finalPos = ps.position
    const pushed = pushOutOfObstacles(finalPos, oriented, CELL_SIZE, puzzle.gridType, obstacles)
    if (pushed) finalPos = pushed

    const clamped = clampToViewport(finalPos, oriented, CELL_SIZE, puzzle.gridType, viewportRef.current)
    if (clamped && !hasObstacleOverlap(clamped, oriented, CELL_SIZE, puzzle.gridType, obstacles)) {
      finalPos = clamped
    }

    if (finalPos !== ps.position) {
      dispatch({ type: 'move', uid: pid, position: finalPos, timestamp: Date.now() })
    }
  }

  /**
   * 回転またはフリップを適用し、ボード上だった場合は再スナップを試みる。
   */
  function applyRotateOrFlip(pid: string, actionType: 'rotate' | 'flip'): void {
    const ts = Date.now()
    const ps = stateRef.current.pieces.find(p => p.uid === pid)!
    const piece = puzzle.pieces[ps.pieceIndex]

    const newOrientIdx = actionType === 'rotate' ? ps.orientationIndex + 1 : ps.orientationIndex
    const newFlipped = actionType === 'flip' ? !ps.flipped : ps.flipped

    dispatch({ type: actionType, uid: pid, timestamp: ts })

    if (!wasOnBoardRef.current) return

    const newOriented = getOrientedCells(piece, newOrientIdx, newFlipped, puzzle.gridType)
    const occupied = collectOccupiedCells(puzzle, stateRef.current.pieces, pid)
    const svgDrop = worldToSvgDrop(ps.position, newOriented, CELL_SIZE, puzzle.gridType, boardOffset)
    const snapPos = findSnapPosition(newOriented, svgDrop, puzzle.board, occupied, CELL_SIZE, puzzle.gridType)

    if (snapPos) {
      const worldPos = svgSnapToWorld(newOriented, snapPos, CELL_SIZE, puzzle.gridType, boardOffset)
      dispatch({ type: 'snap', uid: pid, gridPosition: snapPos, worldPosition: worldPos, timestamp: ts })
    }
    wasOnBoardRef.current = false
  }

  /**
   * 他のピースが画面外にいたら画面内に押し戻す（障害物と重ならない場合のみ）。
   */
  function clampOtherPieces(excludeUid: string): void {
    const latestState = stateRef.current
    for (const other of latestState.pieces) {
      if (other.uid === excludeUid || other.onBoard) continue
      const otherPiece = puzzle.pieces[other.pieceIndex]
      const otherOriented = getOrientedCells(otherPiece, other.orientationIndex, other.flipped, puzzle.gridType)
      const clamped = clampToViewport(other.position, otherOriented, CELL_SIZE, puzzle.gridType, viewportRef.current)
      if (!clamped) continue

      const clampObstacles: Rect[] = [boardBbox]
      for (const p2 of latestState.pieces) {
        if (p2.uid === other.uid || p2.onBoard) continue
        const p2piece = puzzle.pieces[p2.pieceIndex]
        const p2oriented = getOrientedCells(p2piece, p2.orientationIndex, p2.flipped, puzzle.gridType)
        clampObstacles.push(computePieceWorldBbox(p2oriented, CELL_SIZE, puzzle.gridType, p2.position))
      }
      if (!hasObstacleOverlap(clamped, otherOriented, CELL_SIZE, puzzle.gridType, clampObstacles)) {
        dispatch({ type: 'move', uid: other.uid, position: clamped, timestamp: Date.now() })
      }
    }
  }

  useEffect(() => {
    const canvas = gl.domElement

    function handleDown(e: PointerEvent) {
      const world = screenToWorld(e.clientX, e.clientY, camera, canvas)
      const uid = findPieceAtScreen(e.clientX, e.clientY)
      if (!uid) return

      const ps = stateRef.current.pieces.find(p => p.uid === uid)
      if (!ps) return

      draggingRef.current = uid
      dragStartedRef.current = false
      wasOnBoardRef.current = ps.onBoard
      setDraggingPieceId(uid)
      dragStartClient.current = { x: e.clientX, y: e.clientY }
      dragStartWorld.current = { x: world.x, y: world.y }
      pieceStartPos.current = { x: ps.position.x, y: ps.position.y }

      e.preventDefault()
    }

    function handleMove(e: PointerEvent) {
      const pid = draggingRef.current
      if (!pid) return

      const dx = e.clientX - dragStartClient.current.x
      const dy = e.clientY - dragStartClient.current.y

      if (!dragStartedRef.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        dragStartedRef.current = true
        if (wasOnBoardRef.current) {
          const ps = stateRef.current.pieces.find(p => p.uid === pid)
          if (ps) {
            dispatch({ type: 'unsnap', uid: pid, position: ps.position, timestamp: Date.now() })
          }
          wasOnBoardRef.current = false
        }
      }

      if (dragStartedRef.current) {
        const world = screenToWorld(e.clientX, e.clientY, camera, canvas)
        let newX = pieceStartPos.current.x + (world.x - dragStartWorld.current.x)
        let newY = pieceStartPos.current.y + (world.y - dragStartWorld.current.y)
        if (isMobile) newY += 20

        dispatch({ type: 'move', uid: pid, position: { x: newX, y: newY }, timestamp: Date.now() })
      }
    }

    function handleUp(_e: PointerEvent) {
      const pid = draggingRef.current
      if (!pid) return

      const wasDrag = dragStartedRef.current
      draggingRef.current = null
      dragStartedRef.current = false
      setDraggingPieceId(null)

      if (!wasDrag) {
        // タップ: シングル → 回転, ダブル → フリップ
        const now = Date.now()
        const last = lastTapRef.current

        if (last.uid === pid && now - last.time < 300) {
          if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current)
          tapTimeoutRef.current = null
          applyRotateOrFlip(pid, 'flip')
          soundEngine.playFlip()
          lastTapRef.current = { uid: '', time: 0 }
        } else {
          lastTapRef.current = { uid: pid, time: now }
          tapTimeoutRef.current = setTimeout(() => {
            applyRotateOrFlip(pid, 'rotate')
            soundEngine.playRotate()
            tapTimeoutRef.current = null
          }, 300)
        }
      } else {
        handleDropSnap(pid)
      }

      clampOtherPieces(pid)
    }

    canvas.addEventListener('pointerdown', handleDown)
    canvas.addEventListener('pointermove', handleMove)
    canvas.addEventListener('pointerup', handleUp)
    return () => {
      canvas.removeEventListener('pointerdown', handleDown)
      canvas.removeEventListener('pointermove', handleMove)
      canvas.removeEventListener('pointerup', handleUp)
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current)
    }
  }, [camera, gl, dispatch, puzzle, boardOffset, boardBbox, soundEngine, isMobile, setDraggingPieceId])

  return (
    <>
      <Lighting darkMode={darkMode} />
      <BoardMesh cells={puzzle.board} cellSize={CELL_SIZE} gridType={puzzle.gridType} />
      {state.pieces.map(ps => {
        const piece = puzzle.pieces[ps.pieceIndex]
        const oriented = getOrientedCells(piece, ps.orientationIndex, ps.flipped, puzzle.gridType)
        const color = PIECE_PALETTE[ps.pieceIndex % PIECE_PALETTE.length]
        const zPos = ps.uid === draggingPieceId ? 5 : 0

        return (
          <group
            key={ps.uid}
            position={[ps.position.x, ps.position.y, zPos]}
            userData={{ uid: ps.uid }}
            ref={(ref) => {
              if (ref) pieceMeshMap.current.set(ps.uid, ref)
              else pieceMeshMap.current.delete(ps.uid)
            }}
          >
            <PieceMesh
              cells={oriented}
              cellSize={CELL_SIZE}
              gridType={puzzle.gridType}
              color={color}
              position={[0, 0, 0]}
              scale={1}
            />
          </group>
        )
      })}
    </>
  )
}

export function GameScreen({ puzzle, soundEngine, soundEnabled, onToggleSound, onClear }: Props) {
  const [state, dispatch] = useReducer(gameReducer, puzzle, initGameState)
  const [elapsed, setElapsed] = useState(0)
  const [draggingPieceId, setDraggingPieceId] = useState<string | null>(null)
  const isMobile = 'ontouchstart' in window
  const darkMode = false // TODO: window.matchMedia('(prefers-color-scheme: dark)').matches

  const boardOffset = useMemo(
    () => geometryCenteringOffset(puzzle.board, CELL_SIZE, puzzle.gridType),
    [puzzle],
  )

  const boardBbox = useMemo(
    () => computeBoardWorldBbox(puzzle.board, CELL_SIZE, puzzle.gridType),
    [puzzle],
  )

  useEffect(() => {
    if (!state.startedAt) {
      dispatch({ type: 'start', timestamp: Date.now() })
    }
  }, [state.startedAt])

  useEffect(() => {
    if (!state.startedAt) return
    const interval = setInterval(() => setElapsed(Date.now() - state.startedAt!), 100)
    return () => clearInterval(interval)
  }, [state.startedAt])

  // クリア判定
  useEffect(() => {
    const allCovered = collectOccupiedCells(puzzle, state.pieces)
    if (checkCleared(puzzle.board, allCovered) && state.startedAt) {
      const clearTime = Date.now() - state.startedAt
      soundEngine.playFanfare()
      onClear(state, clearTime)
    }
  }, [state.pieces, puzzle, state.startedAt, soundEngine, onClear])

  return (
    <div style={{
      width: '100vw', height: '100dvh', position: 'relative',
      background: darkMode ? '#0a0a1a' : '#e8e0d8',
      touchAction: 'none',
    }}>
      <div style={{
        position: 'absolute', top: 12, left: 16, zIndex: 10,
        color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
        fontSize: 16, fontFamily: 'monospace',
      }}>
        {formatTime(elapsed)}
      </div>
      <div
        onClick={onToggleSound}
        style={{
          position: 'absolute', top: 12, right: 16, zIndex: 10,
          padding: '4px 12px', borderRadius: 12,
          background: soundEnabled ? 'rgba(52,73,94,0.1)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${soundEnabled ? 'rgba(52,73,94,0.25)' : 'rgba(0,0,0,0.1)'}`,
          color: soundEnabled ? 'rgba(52,73,94,0.7)' : 'rgba(0,0,0,0.25)',
          fontSize: 12, cursor: 'pointer', userSelect: 'none',
        }}
      >
        {soundEnabled ? 'SOUND ON' : 'SOUND OFF'}
      </div>
      <Canvas style={{ width: '100%', height: '100%', touchAction: 'none' }}>
        <AutoZoomCamera boardBbox={boardBbox} />
        <Scene
          puzzle={puzzle}
          state={state}
          dispatch={dispatch}
          boardOffset={boardOffset}
          boardBbox={boardBbox}
          soundEngine={soundEngine}
          isMobile={isMobile}
          darkMode={darkMode}
          draggingPieceId={draggingPieceId}
          setDraggingPieceId={setDraggingPieceId}
        />
      </Canvas>
    </div>
  )
}
