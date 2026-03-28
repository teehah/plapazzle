import { useReducer, useEffect, useState, useRef, useMemo } from 'react'
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
 * ボードジオメトリのセンタリングオフセットを計算する。
 * cellsToGeometry と同じ bbox center を使用。
 * このオフセットは SVG座標 ↔ ワールド座標変換に使われる。
 */
function computeBoardOffset(board: Cell[], cellSize: number, gridType: GridType): { x: number; y: number } {
  const ops = GRID_OPS[gridType]
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const cell of board) {
    const pts = ops.cellToSvgPoints(cell, cellSize)
    for (const [px, py] of pts) {
      // geometry.ts と同じ: x = SVG x, y = -SVG y
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (-py < minY) minY = -py
      if (-py > maxY) maxY = -py
    }
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}

/**
 * ボードのワールド座標 bbox を返す。
 * ジオメトリはセンタリング済みなので、ボードメッシュ原点を中心に広がる。
 */
function computeBoardWorldBbox(board: Cell[], cellSize: number, gridType: GridType) {
  const ops = GRID_OPS[gridType]
  let minSvgX = Infinity, maxSvgX = -Infinity, minSvgY = Infinity, maxSvgY = -Infinity
  for (const cell of board) {
    const pts = ops.cellToSvgPoints(cell, cellSize)
    for (const [px, py] of pts) {
      if (px < minSvgX) minSvgX = px
      if (px > maxSvgX) maxSvgX = px
      if (py < minSvgY) minSvgY = py
      if (py > maxSvgY) maxSvgY = py
    }
  }
  // ジオメトリ座標: x = svgX, y = -svgY → センタリング後: 原点中心
  const halfW = (maxSvgX - minSvgX) / 2
  const halfH = (maxSvgY - minSvgY) / 2
  return { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH }
}

/**
 * ピースのワールド座標 bbox を返す。
 * meshPos = ジオメトリ bbox center のワールド座標。
 */
function computePieceWorldBbox(
  oriented: Cell[], cellSize: number, gridType: GridType, meshPos: { x: number; y: number },
) {
  const ops = GRID_OPS[gridType]
  let minSvgX = Infinity, maxSvgX = -Infinity, minSvgY = Infinity, maxSvgY = -Infinity
  for (const cell of oriented) {
    const pts = ops.cellToSvgPoints(cell, cellSize)
    for (const [px, py] of pts) {
      if (px < minSvgX) minSvgX = px
      if (px > maxSvgX) maxSvgX = px
      if (py < minSvgY) minSvgY = py
      if (py > maxSvgY) maxSvgY = py
    }
  }
  const halfW = (maxSvgX - minSvgX) / 2
  const halfH = (maxSvgY - minSvgY) / 2
  return {
    minX: meshPos.x - halfW, maxX: meshPos.x + halfW,
    minY: meshPos.y - halfH, maxY: meshPos.y + halfH,
  }
}

/**
 * ピースがボードと重なっている場合、最短距離でボード外にはじき出した位置を返す。
 * 重なっていなければ null。
 */
function pushOutOfBoard(
  piecePos: { x: number; y: number },
  oriented: Cell[],
  cellSize: number,
  gridType: GridType,
  boardBbox: { minX: number; maxX: number; minY: number; maxY: number },
): { x: number; y: number } | null {
  const margin = cellSize * 0.2  // 少し余裕を持たせる
  const pBbox = computePieceWorldBbox(oriented, cellSize, gridType, piecePos)

  // 重なっていなければそのまま
  if (pBbox.maxX <= boardBbox.minX || pBbox.minX >= boardBbox.maxX ||
      pBbox.maxY <= boardBbox.minY || pBbox.minY >= boardBbox.maxY) {
    return null
  }

  // 4方向への押し出し距離を計算し、最短を選ぶ
  const pushLeft  = boardBbox.minX - pBbox.maxX - margin
  const pushRight = boardBbox.maxX - pBbox.minX + margin
  const pushDown  = boardBbox.minY - pBbox.maxY - margin
  const pushUp    = boardBbox.maxY - pBbox.minY + margin

  const candidates = [
    { dx: pushLeft,  dy: 0, dist: Math.abs(pushLeft) },
    { dx: pushRight, dy: 0, dist: Math.abs(pushRight) },
    { dx: 0, dy: pushDown,  dist: Math.abs(pushDown) },
    { dx: 0, dy: pushUp,    dist: Math.abs(pushUp) },
  ]
  candidates.sort((a, b) => a.dist - b.dist)
  const best = candidates[0]
  return { x: piecePos.x + best.dx, y: piecePos.y + best.dy }
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
 * 全イベントを canvas DOM リスナーで処理する内部コンポーネント。
 * Raycaster でピースの hit 判定を行う。
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
  boardBbox: { minX: number; maxX: number; minY: number; maxY: number }
  soundEngine: SoundEngine
  isMobile: boolean
  darkMode: boolean
  draggingPieceId: string | null
  setDraggingPieceId: (id: string | null) => void
}) {
  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  // ドラッグ状態（全て ref — 同期的に読み書き）
  const draggingRef = useRef<string | null>(null)
  const dragStartedRef = useRef(false)
  const dragStartClient = useRef({ x: 0, y: 0 })
  const dragStartWorld = useRef({ x: 0, y: 0 })
  const pieceStartPos = useRef({ x: 0, y: 0 })
  const lastTapRef = useRef({ uid: '', time: 0 })
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ピース mesh の参照を uid → mesh で保持
  const pieceMeshMap = useRef<Map<string, THREE.Object3D>>(new Map())

  // state を ref に保持（イベントハンドラから最新を読むため）
  const stateRef = useRef(state)
  stateRef.current = state

  // Raycast でクリック位置のピースを特定
  function findPieceAtScreen(clientX: number, clientY: number): string | null {
    const rect = gl.domElement.getBoundingClientRect()
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)

    const pieceMeshes = Array.from(pieceMeshMap.current.values())
    // R3F は rAF で matrixWorld を更新するため、クリック時に未更新の可能性がある
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

  useEffect(() => {
    const canvas = gl.domElement

    function handleDown(e: PointerEvent) {
      const world = screenToWorld(e.clientX, e.clientY, camera, canvas)
      const uid = findPieceAtScreen(e.clientX, e.clientY)
      if (!uid) return

      const ps = stateRef.current.pieces.find(p => p.uid === uid)
      if (!ps) return

      if (ps.onBoard) {
        dispatch({ type: 'unsnap', uid, position: ps.position, timestamp: Date.now() })
      }

      draggingRef.current = uid
      dragStartedRef.current = false
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
      }

      if (dragStartedRef.current) {
        const world = screenToWorld(e.clientX, e.clientY, camera, canvas)
        const worldDx = world.x - dragStartWorld.current.x
        const worldDy = world.y - dragStartWorld.current.y

        let newX = pieceStartPos.current.x + worldDx
        let newY = pieceStartPos.current.y + worldDy
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

      const currentState = stateRef.current

      if (!wasDrag) {
        // タップ
        const now = Date.now()
        const last = lastTapRef.current
        if (last.uid === pid && now - last.time < 300) {
          if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current)
          tapTimeoutRef.current = null
          dispatch({ type: 'flip', uid: pid, timestamp: now })
          soundEngine.playFlip()
          lastTapRef.current = { uid: '', time: 0 }
        } else {
          lastTapRef.current = { uid: pid, time: now }
          tapTimeoutRef.current = setTimeout(() => {
            dispatch({ type: 'rotate', uid: pid, timestamp: Date.now() })
            soundEngine.playRotate()
            tapTimeoutRef.current = null
          }, 300)
        }
      } else {
        // ドラッグ終了 → スナップ判定
        const ps = currentState.pieces.find(p => p.uid === pid)!
        const piece = puzzle.pieces[ps.pieceIndex]
        const oriented = getOrientedCells(piece, ps.orientationIndex, ps.flipped, puzzle.gridType)

        const occupied: Cell[] = []
        for (const other of currentState.pieces) {
          if (other.uid === pid) continue
          if (other.onBoard && other.gridPosition) {
            const otherPiece = puzzle.pieces[other.pieceIndex]
            const otherOriented = getOrientedCells(otherPiece, other.orientationIndex, other.flipped, puzzle.gridType)
            occupied.push(...getPlacedCells(otherOriented, other.gridPosition))
          }
        }

        const svgDrop = worldToSvgDrop(ps.position, oriented, CELL_SIZE, puzzle.gridType, boardOffset)
        const snapPos = findSnapPosition(oriented, svgDrop, puzzle.board, occupied, CELL_SIZE, puzzle.gridType)

        if (snapPos) {
          const worldPos = svgSnapToWorld(oriented, snapPos, CELL_SIZE, puzzle.gridType, boardOffset)
          dispatch({ type: 'snap', uid: pid, gridPosition: snapPos, worldPosition: worldPos, timestamp: Date.now() })
          soundEngine.playSnap()
        } else {
          // スナップしなかった場合、ピースがボードに重なっていたらはじき出す
          const pushed = pushOutOfBoard(ps.position, oriented, CELL_SIZE, puzzle.gridType, boardBbox)
          if (pushed) {
            dispatch({ type: 'move', uid: pid, position: pushed, timestamp: Date.now() })
          }
        }
      }
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
        const color = PIECE_COLORS[ps.pieceId] ?? '#888'
        const isDragging = ps.uid === draggingPieceId
        const zPos = isDragging ? 5 : 0

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
  const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches

  const boardOffset = useMemo(
    () => computeBoardOffset(puzzle.board, CELL_SIZE, puzzle.gridType),
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
    const allCovered: Cell[] = []
    for (const ps of state.pieces) {
      if (ps.onBoard && ps.gridPosition) {
        const piece = puzzle.pieces[ps.pieceIndex]
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
