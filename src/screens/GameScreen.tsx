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

// ピースごとに異なる色を割り当てる（同じ形状でも別の色）
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

type Rect = { minX: number; maxX: number; minY: number; maxY: number }

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.maxX > b.minX && a.minX < b.maxX && a.maxY > b.minY && a.minY < b.maxY
}

/**
 * ピースが障害物（ボード＋他ピース）と重なっている場合、
 * ピース位置から放射状に複数方向を探索し、最短の空き位置にはじき出す。
 * 重なりがなければ null。
 */
function pushOutOfObstacles(
  piecePos: { x: number; y: number },
  oriented: Cell[],
  cellSize: number,
  gridType: GridType,
  obstacles: Rect[],
): { x: number; y: number } | null {
  const margin = cellSize * 0.3
  const step = cellSize * 0.5
  const maxSteps = 20
  const numDirs = 12  // 30度刻み

  function hasOverlap(x: number, y: number): boolean {
    const pBbox = computePieceWorldBbox(oriented, cellSize, gridType, { x, y })
    const padded: Rect = {
      minX: pBbox.minX - margin, maxX: pBbox.maxX + margin,
      minY: pBbox.minY - margin, maxY: pBbox.maxY + margin,
    }
    for (const obs of obstacles) {
      if (rectsOverlap(padded, obs)) return true
    }
    return false
  }

  // 現在位置で重なっていなければ何もしない
  if (!hasOverlap(piecePos.x, piecePos.y)) return null

  // 複数方向に探索し、最短距離で空きが見つかる位置を返す
  let bestPos: { x: number; y: number } | null = null
  let bestDist = Infinity

  for (let d = 0; d < numDirs; d++) {
    const angle = (2 * Math.PI * d) / numDirs
    const dirX = Math.cos(angle)
    const dirY = Math.sin(angle)

    for (let s = 1; s <= maxSteps; s++) {
      const x = piecePos.x + dirX * step * s
      const y = piecePos.y + dirY * step * s
      if (!hasOverlap(x, y)) {
        const dist = s * step
        if (dist < bestDist) {
          bestDist = dist
          bestPos = { x, y }
        }
        break
      }
    }
  }

  return bestPos
}

/**
 * ピースが障害物と重なっているか判定する。
 */
function hasObstacleOverlap(
  piecePos: { x: number; y: number },
  oriented: Cell[],
  cellSize: number,
  gridType: GridType,
  obstacles: Rect[],
): boolean {
  const margin = cellSize * 0.3
  const pBbox = computePieceWorldBbox(oriented, cellSize, gridType, piecePos)
  const padded: Rect = {
    minX: pBbox.minX - margin, maxX: pBbox.maxX + margin,
    minY: pBbox.minY - margin, maxY: pBbox.maxY + margin,
  }
  for (const obs of obstacles) {
    if (rectsOverlap(padded, obs)) return true
  }
  return false
}

/**
 * ピースが画面外に出ていたら画面内にクランプする。
 */
function clampToViewport(
  piecePos: { x: number; y: number },
  oriented: Cell[],
  cellSize: number,
  gridType: GridType,
  viewport: { width: number; height: number },
): { x: number; y: number } | null {
  const pBbox = computePieceWorldBbox(oriented, cellSize, gridType, piecePos)
  const vw = viewport.width / 2
  const vh = viewport.height / 2
  let x = piecePos.x
  let y = piecePos.y
  let clamped = false

  if (pBbox.minX < -vw) { x += -vw - pBbox.minX; clamped = true }
  else if (pBbox.maxX > vw) { x += vw - pBbox.maxX; clamped = true }
  if (pBbox.minY < -vh) { y += -vh - pBbox.minY; clamped = true }
  else if (pBbox.maxY > vh) { y += vh - pBbox.maxY; clamped = true }

  return clamped ? { x, y } : null
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
  const { camera, gl, viewport } = useThree()
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  // ドラッグ状態（全て ref — 同期的に読み書き）
  const draggingRef = useRef<string | null>(null)
  const dragStartedRef = useRef(false)
  const wasOnBoardRef = useRef(false)  // ドラッグ開始時にボード上だったか
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

      // unsnap はドラッグ開始時まで遅延（タップ回転でボード上を維持するため）
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
        // ドラッグ開始時にボード上のピースを unsnap
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

        const applyRotateOrFlip = (type: 'rotate' | 'flip') => {
          const ts = Date.now()
          const ps = stateRef.current.pieces.find(p => p.uid === pid)!
          const piece = puzzle.pieces[ps.pieceIndex]
          const gridPos = ps.gridPosition

          // 新しい orientation/flip を事前計算（dispatch 前）
          const newOrientIdx = type === 'rotate' ? ps.orientationIndex + 1 : ps.orientationIndex
          const newFlipped = type === 'flip' ? !ps.flipped : ps.flipped

          dispatch({ type, uid: pid, timestamp: ts })

          // ボード上だった場合、新しい向きで最寄りの有効位置に再スナップ
          if (wasOnBoardRef.current) {
            const newOriented = getOrientedCells(piece, newOrientIdx, newFlipped, puzzle.gridType)

            const occupied: Cell[] = []
            for (const other of stateRef.current.pieces) {
              if (other.uid === pid) continue
              if (other.onBoard && other.gridPosition) {
                const otherPiece = puzzle.pieces[other.pieceIndex]
                const otherOriented = getOrientedCells(otherPiece, other.orientationIndex, other.flipped, puzzle.gridType)
                occupied.push(...getPlacedCells(otherOriented, other.gridPosition))
              }
            }

            // 現在のワールド位置から SVG ドロップ座標を計算
            const svgDrop = worldToSvgDrop(ps.position, newOriented, CELL_SIZE, puzzle.gridType, boardOffset)
            const snapPos = findSnapPosition(newOriented, svgDrop, puzzle.board, occupied, CELL_SIZE, puzzle.gridType)

            if (snapPos) {
              const worldPos = svgSnapToWorld(newOriented, snapPos, CELL_SIZE, puzzle.gridType, boardOffset)
              dispatch({ type: 'snap', uid: pid, gridPosition: snapPos, worldPosition: worldPos, timestamp: ts })
            }
          }
          wasOnBoardRef.current = false
        }

        if (last.uid === pid && now - last.time < 300) {
          if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current)
          tapTimeoutRef.current = null
          applyRotateOrFlip('flip')
          soundEngine.playFlip()
          lastTapRef.current = { uid: '', time: 0 }
        } else {
          lastTapRef.current = { uid: pid, time: now }
          tapTimeoutRef.current = setTimeout(() => {
            applyRotateOrFlip('rotate')
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
          // スナップしなかった場合、ボード・他ピースと重なっていたらはじき出す
          const obstacles: Rect[] = [boardBbox]
          for (const other of currentState.pieces) {
            if (other.uid === pid || other.onBoard) continue
            const otherPiece = puzzle.pieces[other.pieceIndex]
            const otherOriented = getOrientedCells(otherPiece, other.orientationIndex, other.flipped, puzzle.gridType)
            obstacles.push(computePieceWorldBbox(otherOriented, CELL_SIZE, puzzle.gridType, other.position))
          }
          let finalPos = ps.position
          // 優先度: 1.枠侵入禁止 2.他ピース重なり禁止 3.画面内（1,2に反するなら画面外可）
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
      }

      // 他のピースが画面外にいたら画面内に押し戻す（障害物と重ならない場合のみ）
      const latestState = stateRef.current
      for (const other of latestState.pieces) {
        if (other.uid === pid || other.onBoard) continue
        const otherPiece = puzzle.pieces[other.pieceIndex]
        const otherOriented = getOrientedCells(otherPiece, other.orientationIndex, other.flipped, puzzle.gridType)
        const clamped = clampToViewport(other.position, otherOriented, CELL_SIZE, puzzle.gridType, viewportRef.current)
        if (!clamped) continue
        // クランプ先が枠・他ピースと重ならないか確認
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
  const darkMode = false // TODO: window.matchMedia('(prefers-color-scheme: dark)').matches

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
          background: soundEnabled ? 'rgba(52,73,94,0.1)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${soundEnabled ? 'rgba(52,73,94,0.25)' : 'rgba(0,0,0,0.1)'}`,
          color: soundEnabled ? 'rgba(52,73,94,0.7)' : 'rgba(0,0,0,0.25)',
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
