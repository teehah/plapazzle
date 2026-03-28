# パッキングパズル ゲームUI 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ポリフォーム・パッキングパズルをブラウザ上でインタラクティブに遊べるゲームUIを構築する。3Dレンダリング、タッチ操作、スナップフィット、サウンド、永続化を含む。

**Architecture:** React Three Fiber で3Dレンダリングし、画面遷移は AppState ユニオン型で管理。ゲームロジック（ピース操作・スナップ・クリア判定）は純関数で分離し、IndexedDB で成績を永続化する。既存の `PuzzleDef` / `GridOps` を活用してマルチパズル対応。

**Tech Stack:** TypeScript, React, React Three Fiber, Three.js, @react-three/drei, idb-keyval, Web Audio API, Vite, Vitest

---

## File Map

| ファイル | 責務 |
|---|---|
| `src/App.tsx` | ルート。AppState による画面遷移 |
| `src/screens/TitleScreen.tsx` | タイトル画面 |
| `src/screens/PuzzleSelectScreen.tsx` | パズル選択画面 |
| `src/screens/GameScreen.tsx` | ゲーム画面コンテナ（タイマー、サウンドトグル、Three.js Canvas） |
| `src/screens/ClearAnimation.tsx` | クリア演出画面 |
| `src/screens/ResultScreen.tsx` | 結果表示画面 |
| `src/screens/SolutionGalleryScreen.tsx` | 解法一覧画面 |
| `src/game/state.ts` | ゲーム状態の型定義と初期化・reducer |
| `src/game/snap.ts` | スナップフィット判定ロジック |
| `src/game/clear-check.ts` | クリア判定ロジック |
| `src/game/placement.ts` | ピース配置・変換ユーティリティ（ワールド座標 ↔ グリッド座標） |
| `src/game/__tests__/snap.test.ts` | スナップフィットのテスト |
| `src/game/__tests__/clear-check.test.ts` | クリア判定のテスト |
| `src/game/__tests__/placement.test.ts` | 座標変換のテスト |
| `src/three/BoardMesh.tsx` | ボード（枠）の3Dメッシュ |
| `src/three/PieceMesh.tsx` | ピースの3Dメッシュ（ドラッグ可能） |
| `src/three/Lighting.tsx` | ライトモード/ダークモード切替ライティング |
| `src/three/PieceInteraction.tsx` | タッチ/マウスのドラッグ・回転・反転ハンドラ |
| `src/audio/sound.ts` | Web Audio API サウンドエンジン |
| `src/audio/__tests__/sound.test.ts` | サウンド生成のテスト |
| `src/storage/db.ts` | IndexedDB ストレージ（idb-keyval ラッパー） |
| `src/storage/__tests__/db.test.ts` | ストレージのテスト |

---

## Task 1: 依存パッケージ追加 + プロジェクト構成

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Three.js 関連パッケージをインストール**

```bash
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three
```

- [ ] **Step 2: IndexedDB ラッパーをインストール**

```bash
npm install idb-keyval
```

- [ ] **Step 3: テストが通ることを確認**

```bash
npm test
```

Expected: 既存の全テストが PASS

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add three.js, react-three-fiber, idb-keyval"
```

---

## Task 2: ゲーム状態管理（game/state.ts）

**Files:**
- Create: `src/game/state.ts`
- Create: `src/game/__tests__/state.test.ts`

### 背景知識

ゲームの状態は以下で構成される:
- 各ピースの位置（ワールド座標 x,y）、回転インデックス、反転状態、ボード上に配置済みかどうか
- タイマー開始時刻
- 操作履歴（リプレイ用）

`PuzzleDef` から初期状態を生成し、`useReducer` で状態遷移を管理する。

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/game/__tests__/state.test.ts
import { describe, it, expect } from 'vitest'
import { initGameState, gameReducer } from '../state'
import type { GameState, GameAction } from '../state'

// テスト用の小さなパズル定義
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

  it('startedAtはnull（開始前）', () => {
    const state = initGameState(testPuzzle)
    expect(state.startedAt).toBeNull()
  })
})

describe('gameReducer', () => {
  it('rotate でorientationIndexが1増える', () => {
    const state = initGameState(testPuzzle)
    const next = gameReducer(state, {
      type: 'rotate',
      pieceId: 'A',
      timestamp: 100,
    })
    const pieceA = next.pieces.find(p => p.pieceId === 'A')!
    expect(pieceA.orientationIndex).toBe(1)
  })

  it('flip でflippedが反転する', () => {
    const state = initGameState(testPuzzle)
    const next = gameReducer(state, {
      type: 'flip',
      pieceId: 'A',
      timestamp: 100,
    })
    const pieceA = next.pieces.find(p => p.pieceId === 'A')!
    expect(pieceA.flipped).toBe(true)
  })

  it('move で位置が更新される', () => {
    const state = initGameState(testPuzzle)
    const next = gameReducer(state, {
      type: 'move',
      pieceId: 'A',
      position: { x: 50, y: 100 },
      timestamp: 100,
    })
    const pieceA = next.pieces.find(p => p.pieceId === 'A')!
    expect(pieceA.position).toEqual({ x: 50, y: 100 })
  })

  it('snap でonBoardがtrueになりgridPositionが設定される', () => {
    const state = initGameState(testPuzzle)
    const next = gameReducer(state, {
      type: 'snap',
      pieceId: 'A',
      gridPosition: { row: 0, col: 0 },
      worldPosition: { x: 10, y: 20 },
      timestamp: 100,
    })
    const pieceA = next.pieces.find(p => p.pieceId === 'A')!
    expect(pieceA.onBoard).toBe(true)
    expect(pieceA.gridPosition).toEqual({ row: 0, col: 0 })
  })

  it('アクションがactionsに記録される', () => {
    const state = initGameState(testPuzzle)
    const next = gameReducer(state, {
      type: 'rotate',
      pieceId: 'A',
      timestamp: 100,
    })
    expect(next.actions).toHaveLength(1)
    expect(next.actions[0].type).toBe('rotate')
  })

  it('start でstartedAtが設定される', () => {
    const state = initGameState(testPuzzle)
    const next = gameReducer(state, {
      type: 'start',
      timestamp: 1000,
    })
    expect(next.startedAt).toBe(1000)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/game/__tests__/state.test.ts
```

Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: state.ts を実装する**

```typescript
// src/game/state.ts
import type { PuzzleDef } from '../core/puzzle'
import type { GridType } from '../core/grid-ops'
import { GRID_OPS } from '../core/grid-ops'

export type Position = { x: number; y: number }
export type GridPosition = { row: number; col: number }

export type PieceState = {
  pieceId: string
  position: Position           // ワールド座標
  orientationIndex: number     // uniqueOrientations() のインデックス
  flipped: boolean
  onBoard: boolean             // ボード上に配置済みか
  gridPosition: GridPosition | null  // スナップ時のグリッド座標
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
  | { type: 'rotate'; pieceId: string; timestamp: number }
  | { type: 'flip'; pieceId: string; timestamp: number }
  | { type: 'move'; pieceId: string; position: Position; timestamp: number }
  | { type: 'snap'; pieceId: string; gridPosition: GridPosition; worldPosition: Position; timestamp: number }
  | { type: 'unsnap'; pieceId: string; position: Position; timestamp: number }

export function initGameState(puzzle: PuzzleDef): GameState {
  const ops = GRID_OPS[puzzle.gridType]
  const maxOrientations = puzzle.pieces.map(p => ops.uniqueOrientations(p.cells).length)

  const pieces: PieceState[] = puzzle.pieces.map((p, i) => ({
    pieceId: p.id,
    position: { x: 0, y: 0 },  // 実際の初期配置は GameScreen で計算
    orientationIndex: 0,
    flipped: false,
    onBoard: false,
    gridPosition: null,
  }))

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
  pieceId: string,
  updater: (p: PieceState) => PieceState
): PieceState[] {
  return pieces.map(p => p.pieceId === pieceId ? updater(p) : p)
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const record: RecordedAction = { ...action }

  switch (action.type) {
    case 'start':
      return {
        ...state,
        startedAt: action.timestamp,
        actions: [...state.actions, record],
      }

    case 'rotate': {
      const ops = GRID_OPS[state.gridType]
      return {
        ...state,
        pieces: updatePiece(state.pieces, action.pieceId, p => {
          const piece = { id: p.pieceId, cells: [] }  // cells は orientationIndex で管理
          const totalOrientations = state.gridType === 'triangular' ? 12 : 8
          return {
            ...p,
            orientationIndex: (p.orientationIndex + 1) % totalOrientations,
            onBoard: false,
            gridPosition: null,
          }
        }),
        actions: [...state.actions, record],
      }
    }

    case 'flip':
      return {
        ...state,
        pieces: updatePiece(state.pieces, action.pieceId, p => ({
          ...p,
          flipped: !p.flipped,
          onBoard: false,
          gridPosition: null,
        })),
        actions: [...state.actions, record],
      }

    case 'move':
      return {
        ...state,
        pieces: updatePiece(state.pieces, action.pieceId, p => ({
          ...p,
          position: action.position,
        })),
        actions: [...state.actions, record],
      }

    case 'snap':
      return {
        ...state,
        pieces: updatePiece(state.pieces, action.pieceId, p => ({
          ...p,
          position: action.worldPosition,
          onBoard: true,
          gridPosition: action.gridPosition,
        })),
        actions: [...state.actions, record],
      }

    case 'unsnap':
      return {
        ...state,
        pieces: updatePiece(state.pieces, action.pieceId, p => ({
          ...p,
          position: action.position,
          onBoard: false,
          gridPosition: null,
        })),
        actions: [...state.actions, record],
      }

    default:
      return state
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/game/__tests__/state.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/state.ts src/game/__tests__/state.test.ts
git commit -m "feat: game state management with reducer (TDD)"
```

---

## Task 3: ピース配置ユーティリティ（game/placement.ts）

**Files:**
- Create: `src/game/placement.ts`
- Create: `src/game/__tests__/placement.test.ts`

### 背景知識

ゲームでは2つの座標系を使う:
- **ワールド座標** (x, y): Three.js のシーン内の位置。ピクセル単位。
- **グリッド座標** (row, col): `Cell` の座標。`cellToSvgPoints` で変換可能。

このモジュールはグリッド座標 ↔ ワールド座標の変換と、ピースの向き（orientationIndex + flipped）から実際のセル配列を取得する機能を提供する。

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/game/__tests__/placement.test.ts
import { describe, it, expect } from 'vitest'
import {
  gridToWorld,
  worldToNearestGrid,
  getOrientedCells,
  getPlacedCells,
} from '../placement'
import type { Cell } from '../../core/grid'

describe('gridToWorld (triangular)', () => {
  const H = 30
  it('(0,0,0) のワールド座標中心を返す', () => {
    const pos = gridToWorld({ row: 0, col: 0, dir: 0 }, H, 'triangular')
    // △(0,0) の3頂点の重心
    expect(pos.x).toBeCloseTo(17.32, 1)  // W = 34.64, centroid x = W/2
    expect(pos.y).toBeCloseTo(20, 1)     // centroid y = 2*H/3 = 20
  })
})

describe('worldToNearestGrid (triangular)', () => {
  const H = 30
  it('ワールド座標からグリッド座標を推定する', () => {
    // (0,0,0) の重心近くの座標
    const cell = worldToNearestGrid(17, 20, H, 'triangular', [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 0, dir: 1 },
      { row: 0, col: 1, dir: 0 },
    ])
    expect(cell).toEqual({ row: 0, col: 0, dir: 0 })
  })
})

describe('getOrientedCells', () => {
  const piece = {
    id: 'I',
    cells: [
      { row: 0, col: 0, dir: 0 as const },
      { row: 0, col: 0, dir: 1 as const },
    ],
  }

  it('orientationIndex=0, flipped=false は元のセルを返す', () => {
    const cells = getOrientedCells(piece, 0, false, 'triangular')
    expect(cells).toHaveLength(2)
  })

  it('orientationIndex=1 は回転したセルを返す', () => {
    const cells0 = getOrientedCells(piece, 0, false, 'triangular')
    const cells1 = getOrientedCells(piece, 1, false, 'triangular')
    // 回転すると座標が変わる
    const key0 = cells0.map(c => `${c.row},${c.col},${c.dir}`).join('|')
    const key1 = cells1.map(c => `${c.row},${c.col},${c.dir}`).join('|')
    expect(key0).not.toBe(key1)
  })
})

describe('getPlacedCells', () => {
  it('gridPosition に基づいてセルを平行移動する', () => {
    const cells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
    ]
    const placed = getPlacedCells(cells, { row: 2, col: 3 })
    expect(placed).toContainEqual({ row: 2, col: 3, dir: 0 })
    expect(placed).toContainEqual({ row: 2, col: 4, dir: 0 })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/game/__tests__/placement.test.ts
```

Expected: FAIL

- [ ] **Step 3: placement.ts を実装する**

```typescript
// src/game/placement.ts
import type { Cell } from '../core/grid'
import type { PieceDef } from '../core/piece'
import type { GridType } from '../core/grid-ops'
import { GRID_OPS } from '../core/grid-ops'
import type { GridPosition, Position } from './state'

/**
 * セルの重心ワールド座標を返す
 */
export function gridToWorld(cell: Cell, size: number, gridType: GridType): Position {
  const ops = GRID_OPS[gridType]
  const pts = ops.cellToSvgPoints(cell, size)
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
  return { x: cx, y: cy }
}

/**
 * ワールド座標から最も近いボードセルを返す
 */
export function worldToNearestGrid(
  wx: number,
  wy: number,
  size: number,
  gridType: GridType,
  boardCells: Cell[],
): Cell | null {
  let best: Cell | null = null
  let bestDist = Infinity
  for (const cell of boardCells) {
    const center = gridToWorld(cell, size, gridType)
    const dx = wx - center.x
    const dy = wy - center.y
    const dist = dx * dx + dy * dy
    if (dist < bestDist) {
      bestDist = dist
      best = cell
    }
  }
  return best
}

/**
 * ピースの orientationIndex と flipped から実際のセル配列を取得する。
 * 返るセルは normalize 済み（minRow=0, minCol=0）。
 */
export function getOrientedCells(
  piece: PieceDef,
  orientationIndex: number,
  flipped: boolean,
  gridType: GridType,
): Cell[] {
  const ops = GRID_OPS[gridType]
  const allOrientations = ops.uniqueOrientations(piece.cells)

  // uniqueOrientations は回転6 × 反転2 = 最大12。
  // flipped=false なら前半（回転のみ）、flipped=true なら後半（反転+回転）。
  // ただし重複除去済みなので直接インデックスアクセスする。
  // orientationIndex は全向きの中のインデックス。
  const idx = orientationIndex % allOrientations.length
  return allOrientations[idx]
}

/**
 * 正規化済みセル配列を gridPosition に平行移動する
 */
export function getPlacedCells(
  orientedCells: Cell[],
  gridPosition: GridPosition,
): Cell[] {
  return orientedCells.map(c => ({
    row: c.row + gridPosition.row,
    col: c.col + gridPosition.col,
    dir: c.dir,
  }))
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/game/__tests__/placement.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/placement.ts src/game/__tests__/placement.test.ts
git commit -m "feat: piece placement utilities with coordinate conversion (TDD)"
```

---

## Task 4: スナップフィット判定（game/snap.ts）

**Files:**
- Create: `src/game/snap.ts`
- Create: `src/game/__tests__/snap.test.ts`

### 背景知識

ピースをボード近くでドロップした時、有効な配置位置（全セルがボード内 & 他ピースと重ならない）にスナップする。

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/game/__tests__/snap.test.ts
import { describe, it, expect } from 'vitest'
import { findSnapPosition } from '../snap'
import type { Cell } from '../../core/grid'
import type { PieceState } from '../state'

const board: Cell[] = [
  { row: 0, col: 0, dir: 0 },
  { row: 0, col: 1, dir: 0 },
  { row: 0, col: 2, dir: 0 },
  { row: 1, col: 0, dir: 0 },
  { row: 1, col: 1, dir: 0 },
  { row: 1, col: 2, dir: 0 },
]

describe('findSnapPosition', () => {
  it('空のボードに1セルピースをスナップできる', () => {
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const occupiedCells: Cell[] = []
    const result = findSnapPosition(
      orientedCells,
      { x: 15, y: 15 },  // ドロップ位置（ワールド座標）
      board,
      occupiedCells,
      30,              // cellSize
      'square',
    )
    expect(result).not.toBeNull()
    expect(result!.row).toBeGreaterThanOrEqual(0)
    expect(result!.col).toBeGreaterThanOrEqual(0)
  })

  it('全セルが占有済みならスナップできない', () => {
    const orientedCells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const occupiedCells = [...board]  // 全セル占有
    const result = findSnapPosition(
      orientedCells,
      { x: 15, y: 15 },
      board,
      occupiedCells,
      30,
      'square',
    )
    expect(result).toBeNull()
  })

  it('ボード外にはみ出す配置はスナップしない', () => {
    const orientedCells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
      { row: 0, col: 2, dir: 0 },
      { row: 0, col: 3, dir: 0 },  // col=3 はボード外
    ]
    const result = findSnapPosition(
      orientedCells,
      { x: 15, y: 15 },
      board,
      [],
      30,
      'square',
    )
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/game/__tests__/snap.test.ts
```

Expected: FAIL

- [ ] **Step 3: snap.ts を実装する**

```typescript
// src/game/snap.ts
import type { Cell } from '../core/grid'
import { cellKey } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import type { Position, GridPosition } from './state'
import { gridToWorld, worldToNearestGrid, getPlacedCells } from './placement'

/**
 * ドロップ位置から最適なスナップ先グリッド座標を見つける。
 * 有効な位置がなければ null を返す。
 *
 * @param orientedCells ピースの正規化済みセル（orientationIndex適用済み）
 * @param dropPosition ドロップ位置（ワールド座標）
 * @param boardCells ボードの全セル
 * @param occupiedCells 他のピースが占有中のセル
 * @param cellSize セルサイズ（Three.js単位）
 * @param gridType グリッド種類
 */
export function findSnapPosition(
  orientedCells: Cell[],
  dropPosition: Position,
  boardCells: Cell[],
  occupiedCells: Cell[],
  cellSize: number,
  gridType: GridType,
): GridPosition | null {
  // ドロップ位置に最も近いボードセルを探す
  const nearestCell = worldToNearestGrid(
    dropPosition.x,
    dropPosition.y,
    cellSize,
    gridType,
    boardCells,
  )
  if (!nearestCell) return null

  // スナップ距離の閾値チェック
  const nearestCenter = gridToWorld(nearestCell, cellSize, gridType)
  const dx = dropPosition.x - nearestCenter.x
  const dy = dropPosition.y - nearestCenter.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const threshold = cellSize * 1.5  // セルサイズの1.5倍以内
  if (dist > threshold) return null

  // ピースの基準セル（minRow, minCol = 0,0）を nearestCell に配置した場合のオフセットを計算
  const boardSet = new Set(boardCells.map(cellKey))
  const occupiedSet = new Set(occupiedCells.map(cellKey))

  // nearestCell 周辺のオフセットを試す
  const minR = Math.min(...orientedCells.map(c => c.row))
  const minC = Math.min(...orientedCells.map(c => c.col))

  // nearestCell を基準にピースの各セルのオフセットを試す
  for (const refCell of orientedCells) {
    const offsetRow = nearestCell.row - refCell.row
    const offsetCol = nearestCell.col - refCell.col
    const placed = getPlacedCells(orientedCells, { row: offsetRow, col: offsetCol })

    // 全セルがボード内 & 非占有 か確認
    let valid = true
    for (const pc of placed) {
      const key = cellKey(pc)
      if (!boardSet.has(key) || occupiedSet.has(key)) {
        valid = false
        break
      }
    }
    if (valid) {
      return { row: offsetRow, col: offsetCol }
    }
  }

  return null
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/game/__tests__/snap.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/snap.ts src/game/__tests__/snap.test.ts
git commit -m "feat: snap-fit logic for piece placement (TDD)"
```

---

## Task 5: クリア判定（game/clear-check.ts）

**Files:**
- Create: `src/game/clear-check.ts`
- Create: `src/game/__tests__/clear-check.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/game/__tests__/clear-check.test.ts
import { describe, it, expect } from 'vitest'
import { checkCleared } from '../clear-check'
import type { Cell } from '../../core/grid'
import type { PieceState } from '../state'

const board: Cell[] = [
  { row: 0, col: 0, dir: 0 },
  { row: 0, col: 1, dir: 0 },
]

describe('checkCleared', () => {
  it('全セルが埋まっていればtrue', () => {
    const coveredCells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
    ]
    expect(checkCleared(board, coveredCells)).toBe(true)
  })

  it('セルが足りなければfalse', () => {
    const coveredCells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
    ]
    expect(checkCleared(board, coveredCells)).toBe(false)
  })

  it('空ならfalse', () => {
    expect(checkCleared(board, [])).toBe(false)
  })

  it('ボードにないセルが含まれていてもボードが埋まっていればtrue', () => {
    const coveredCells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
      { row: 9, col: 9, dir: 0 },  // ボード外
    ]
    expect(checkCleared(board, coveredCells)).toBe(true)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/game/__tests__/clear-check.test.ts
```

Expected: FAIL

- [ ] **Step 3: clear-check.ts を実装する**

```typescript
// src/game/clear-check.ts
import type { Cell } from '../core/grid'
import { cellKey } from '../core/grid'

/**
 * ボードの全セルが coveredCells で覆われているか判定する。
 */
export function checkCleared(boardCells: Cell[], coveredCells: Cell[]): boolean {
  const coveredSet = new Set(coveredCells.map(cellKey))
  return boardCells.every(cell => coveredSet.has(cellKey(cell)))
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/game/__tests__/clear-check.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/clear-check.ts src/game/__tests__/clear-check.test.ts
git commit -m "feat: clear check logic (TDD)"
```

---

## Task 6: サウンドエンジン（audio/sound.ts）

**Files:**
- Create: `src/audio/sound.ts`
- Create: `src/audio/__tests__/sound.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/audio/__tests__/sound.test.ts
import { describe, it, expect, vi } from 'vitest'
import { SoundEngine } from '../sound'

describe('SoundEngine', () => {
  it('enabled=false の時 play は何もしない', () => {
    const engine = new SoundEngine(false)
    // AudioContext が無い環境でもエラーにならない
    expect(() => engine.playClick()).not.toThrow()
    expect(() => engine.playSnap()).not.toThrow()
    expect(() => engine.playFanfare()).not.toThrow()
  })

  it('setEnabled で有効/無効を切り替えられる', () => {
    const engine = new SoundEngine(false)
    expect(engine.isEnabled()).toBe(false)
    engine.setEnabled(true)
    expect(engine.isEnabled()).toBe(true)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/audio/__tests__/sound.test.ts
```

Expected: FAIL

- [ ] **Step 3: sound.ts を実装する**

```typescript
// src/audio/sound.ts

export class SoundEngine {
  private ctx: AudioContext | null = null
  private enabled: boolean

  constructor(enabled: boolean = false) {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (enabled && !this.ctx) {
      this.ctx = new AudioContext()
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  private playTone(freq: number, duration: number, gain: number = 0.15): void {
    const ctx = this.ensureContext()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.frequency.value = freq
    osc.type = 'sine'
    g.gain.setValueAtTime(gain, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  }

  /** ピース移動: 小さなカチッ音 */
  playClick(): void {
    this.playTone(200, 0.05, 0.1)
  }

  /** ピース回転: やや高めのカチカチ音 */
  playRotate(): void {
    this.playTone(400, 0.03, 0.12)
  }

  /** ピース反転: パタッ音 */
  playFlip(): void {
    this.playTone(150, 0.08, 0.1)
    setTimeout(() => this.playTone(300, 0.05, 0.08), 30)
  }

  /** スナップフィット: パチッ音 */
  playSnap(): void {
    this.playTone(500, 0.1, 0.2)
    this.playTone(1000, 0.08, 0.1)
  }

  /** クリア: ファンファーレ（C-E-G-C上昇音階） */
  playFanfare(): void {
    const notes = [261.6, 329.6, 392.0, 523.3]  // C4, E4, G4, C5
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.3, 0.2), i * 200)
    })
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/audio/__tests__/sound.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/audio/sound.ts src/audio/__tests__/sound.test.ts
git commit -m "feat: Web Audio API sound engine (TDD)"
```

---

## Task 7: IndexedDB ストレージ（storage/db.ts）

**Files:**
- Create: `src/storage/db.ts`
- Create: `src/storage/__tests__/db.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/storage/__tests__/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { GameStorage } from '../db'

describe('GameStorage', () => {
  let storage: GameStorage

  beforeEach(() => {
    storage = new GameStorage()
    storage.clear()
  })

  it('初期状態でベストタイムはnull', async () => {
    const record = await storage.getPuzzleRecord('no6')
    expect(record.bestTimeMs).toBeNull()
  })

  it('クリア記録を保存すると取得できる', async () => {
    await storage.saveClear({
      puzzleId: 'no6',
      solutionId: 42,
      clearTimeMs: 5000,
      actions: [],
      clearedAt: new Date().toISOString(),
    })
    const record = await storage.getPuzzleRecord('no6')
    expect(record.bestTimeMs).toBe(5000)
    expect(record.discoveredSolutionIds).toContain(42)
    expect(record.totalClears).toBe(1)
  })

  it('ベストタイムは最小値が保持される', async () => {
    await storage.saveClear({
      puzzleId: 'no6', solutionId: 1, clearTimeMs: 10000,
      actions: [], clearedAt: new Date().toISOString(),
    })
    await storage.saveClear({
      puzzleId: 'no6', solutionId: 2, clearTimeMs: 5000,
      actions: [], clearedAt: new Date().toISOString(),
    })
    await storage.saveClear({
      puzzleId: 'no6', solutionId: 3, clearTimeMs: 8000,
      actions: [], clearedAt: new Date().toISOString(),
    })
    const record = await storage.getPuzzleRecord('no6')
    expect(record.bestTimeMs).toBe(5000)
    expect(record.totalClears).toBe(3)
  })

  it('サウンド設定を保存・取得できる', async () => {
    expect(await storage.getSoundEnabled()).toBe(false)
    await storage.setSoundEnabled(true)
    expect(await storage.getSoundEnabled()).toBe(true)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/storage/__tests__/db.test.ts
```

Expected: FAIL

- [ ] **Step 3: db.ts を実装する**

```typescript
// src/storage/db.ts
import { get, set, del, clear as clearAll } from 'idb-keyval'

export interface ClearRecord {
  puzzleId: string
  solutionId: number
  clearTimeMs: number
  actions: Array<{
    type: string
    pieceId?: string
    position?: { x: number; y: number }
    gridPosition?: { row: number; col: number }
    orientationIndex?: number
    timestamp: number
  }>
  clearedAt: string
}

export interface PuzzleRecord {
  bestTimeMs: number | null
  discoveredSolutionIds: number[]
  totalClears: number
}

const PUZZLE_PREFIX = 'puzzle:'
const CLEARS_PREFIX = 'clears:'
const SETTINGS_KEY = 'settings'

export class GameStorage {
  async getPuzzleRecord(puzzleId: string): Promise<PuzzleRecord> {
    const record = await get<PuzzleRecord>(`${PUZZLE_PREFIX}${puzzleId}`)
    return record ?? { bestTimeMs: null, discoveredSolutionIds: [], totalClears: 0 }
  }

  async saveClear(clearRecord: ClearRecord): Promise<void> {
    const { puzzleId, solutionId, clearTimeMs } = clearRecord

    // パズル成績を更新
    const current = await this.getPuzzleRecord(puzzleId)
    const newRecord: PuzzleRecord = {
      bestTimeMs: current.bestTimeMs === null
        ? clearTimeMs
        : Math.min(current.bestTimeMs, clearTimeMs),
      discoveredSolutionIds: current.discoveredSolutionIds.includes(solutionId)
        ? current.discoveredSolutionIds
        : [...current.discoveredSolutionIds, solutionId],
      totalClears: current.totalClears + 1,
    }
    await set(`${PUZZLE_PREFIX}${puzzleId}`, newRecord)

    // 個別クリア記録を保存
    const clears = await this.getClears(puzzleId)
    clears.push(clearRecord)
    await set(`${CLEARS_PREFIX}${puzzleId}`, clears)
  }

  async getClears(puzzleId: string): Promise<ClearRecord[]> {
    return (await get<ClearRecord[]>(`${CLEARS_PREFIX}${puzzleId}`)) ?? []
  }

  async getSoundEnabled(): Promise<boolean> {
    const settings = await get<{ soundEnabled: boolean }>(SETTINGS_KEY)
    return settings?.soundEnabled ?? false
  }

  async setSoundEnabled(enabled: boolean): Promise<void> {
    await set(SETTINGS_KEY, { soundEnabled: enabled })
  }

  clear(): void {
    clearAll()
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/storage/__tests__/db.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/storage/db.ts src/storage/__tests__/db.test.ts
git commit -m "feat: IndexedDB game storage with idb-keyval (TDD)"
```

---

## Task 8: 3Dメッシュ — ボードとピース（three/BoardMesh.tsx, PieceMesh.tsx）

**Files:**
- Create: `src/three/BoardMesh.tsx`
- Create: `src/three/PieceMesh.tsx`
- Create: `src/three/Lighting.tsx`
- Create: `src/three/geometry.ts`

### 背景知識

Three.js で三角形（または正方形）セルを薄い三角柱（または角柱）として ExtrudeGeometry で生成する。ピースは複数セルをマージした単一 BufferGeometry とする。MeshPhysicalMaterial でガラスの透過・屈折を表現する。

テストは視覚的な要素のためスキップし、dev server で目視確認する。

- [ ] **Step 1: geometry.ts を実装する（セル→3Dジオメトリ変換）**

```typescript
// src/three/geometry.ts
import * as THREE from 'three'
import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { GRID_OPS } from '../core/grid-ops'

const EXTRUDE_DEPTH = 3  // ピースの厚み
const BEVEL_SIZE = 0.3
const BEVEL_SEGMENTS = 2

/**
 * セル配列から ExtrudeGeometry を生成する。
 * 各セルを Shape として定義し、マージした単一ジオメトリを返す。
 */
export function cellsToGeometry(
  cells: Cell[],
  cellSize: number,
  gridType: GridType,
): THREE.BufferGeometry {
  const ops = GRID_OPS[gridType]
  const geometries: THREE.ExtrudeGeometry[] = []

  for (const cell of cells) {
    const pts = ops.cellToSvgPoints(cell, cellSize)
    const shape = new THREE.Shape()
    shape.moveTo(pts[0][0], -pts[0][1])  // SVG Y を反転
    for (let i = 1; i < pts.length; i++) {
      shape.lineTo(pts[i][0], -pts[i][1])
    }
    shape.closePath()

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: EXTRUDE_DEPTH,
      bevelEnabled: true,
      bevelSize: BEVEL_SIZE,
      bevelThickness: BEVEL_SIZE,
      bevelSegments: BEVEL_SEGMENTS,
    })
    geometries.push(geo)
  }

  // 全セルをマージ
  const merged = new THREE.BufferGeometry()
  const mergedGeos = geometries.map(g => g)
  // mergeBufferGeometries が非推奨なので mergeGeometries を使用
  const result = THREE.BufferGeometryUtils
    ? THREE.BufferGeometryUtils.mergeGeometries(mergedGeos)
    : mergeManually(mergedGeos)

  geometries.forEach(g => g.dispose())
  return result ?? merged
}

function mergeManually(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // BufferGeometryUtils が使えない場合の簡易マージ
  const merged = new THREE.BufferGeometry()
  if (geometries.length === 0) return merged
  if (geometries.length === 1) return geometries[0]

  // mergeGeometries を drei から使う代わりに、Group で代替する可能性あり
  // 実装時に @react-three/drei の mergeBufferGeometries を使用
  return geometries[0]
}
```

注: `BufferGeometryUtils.mergeGeometries` の正確なインポート方法は実装時に確認。`three/addons` または `three/examples/jsm/utils/BufferGeometryUtils` から取得。

- [ ] **Step 2: BoardMesh.tsx を実装する**

```tsx
// src/three/BoardMesh.tsx
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { cellsToGeometry } from './geometry'

type Props = {
  cells: Cell[]
  cellSize: number
  gridType: GridType
}

export function BoardMesh({ cells, cellSize, gridType }: Props) {
  const geometry = useMemo(
    () => cellsToGeometry(cells, cellSize, gridType),
    [cells, cellSize, gridType],
  )

  // ボードの重心を原点に合わせるオフセット
  const center = useMemo(() => {
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    return new THREE.Vector3(
      -(box.min.x + box.max.x) / 2,
      -(box.min.y + box.max.y) / 2,
      0,
    )
  }, [geometry])

  return (
    <mesh geometry={geometry} position={[center.x, center.y, -2]}>
      <meshPhysicalMaterial
        transmission={0.9}
        roughness={0.1}
        ior={1.5}
        thickness={2}
        color="#ffffff"
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
```

- [ ] **Step 3: PieceMesh.tsx を実装する**

```tsx
// src/three/PieceMesh.tsx
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { cellsToGeometry } from './geometry'

type Props = {
  cells: Cell[]
  cellSize: number
  gridType: GridType
  color: string
  position: [number, number, number]
  scale?: number
  onPointerDown?: (e: THREE.Event) => void
}

export function PieceMesh({
  cells,
  cellSize,
  gridType,
  color,
  position,
  scale = 1,
  onPointerDown,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null)

  const geometry = useMemo(
    () => cellsToGeometry(cells, cellSize, gridType),
    [cells, cellSize, gridType],
  )

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={position}
      scale={[scale, scale, scale]}
      onPointerDown={onPointerDown}
    >
      <meshPhysicalMaterial
        transmission={0.7}
        roughness={0.15}
        ior={1.45}
        thickness={1.5}
        color={color}
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
```

- [ ] **Step 4: Lighting.tsx を実装する**

```tsx
// src/three/Lighting.tsx

type Props = {
  darkMode: boolean
}

export function Lighting({ darkMode }: Props) {
  if (darkMode) {
    return (
      <>
        <ambientLight intensity={0.2} />
        <spotLight
          position={[0, 0, 50]}
          angle={0.5}
          penumbra={0.8}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
      </>
    )
  }

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 5, 30]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
    </>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/three/
git commit -m "feat: Three.js board and piece meshes with glass material"
```

---

## Task 9: 画面コンポーネント — タイトル・パズル選択・結果（screens/）

**Files:**
- Create: `src/screens/TitleScreen.tsx`
- Create: `src/screens/PuzzleSelectScreen.tsx`
- Create: `src/screens/ResultScreen.tsx`
- Create: `src/screens/SolutionGalleryScreen.tsx`
- Create: `src/screens/ClearAnimation.tsx`

テストは視覚コンポーネントのため目視確認。各画面は props でコールバックを受け取るステートレス設計。

- [ ] **Step 1: TitleScreen.tsx を実装する**

```tsx
// src/screens/TitleScreen.tsx

type Props = {
  onStart: () => void
}

export function TitleScreen({ onStart }: Props) {
  return (
    <div
      onClick={onStart}
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%)',
        cursor: 'pointer',
        userSelect: 'none',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: 3 }}>
        POLYFORM
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: 5, marginTop: 4 }}>
        PACKING PUZZLE
      </div>
      <div style={{
        marginTop: 40,
        padding: '10px 40px',
        border: '1px solid rgba(100,200,255,0.3)',
        borderRadius: 25,
        color: 'rgba(100,200,255,0.8)',
        fontSize: 13,
        letterSpacing: 2,
      }}>
        TAP TO START
      </div>
    </div>
  )
}
```

- [ ] **Step 2: PuzzleSelectScreen.tsx を実装する**

```tsx
// src/screens/PuzzleSelectScreen.tsx
import type { PuzzleDef } from '../core/puzzle'
import type { PuzzleRecord } from '../storage/db'

type Props = {
  puzzles: PuzzleDef[]
  records: Map<string, PuzzleRecord>
  onSelect: (puzzleId: string) => void
  onGallery: (puzzleId: string) => void
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function PuzzleSelectScreen({ puzzles, records, onSelect, onGallery }: Props) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(135deg, #0d1117, #1a1a2e)',
      padding: 24,
      fontFamily: 'sans-serif',
    }}>
      <h1 style={{ textAlign: 'center', color: '#fff', fontSize: 18, marginBottom: 24 }}>
        パズルを選ぶ
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400, margin: '0 auto' }}>
        {puzzles.map(puzzle => {
          const record = records.get(puzzle.id) ?? {
            bestTimeMs: null, discoveredSolutionIds: [], totalClears: 0,
          }
          return (
            <div
              key={puzzle.id}
              onClick={() => onSelect(puzzle.id)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(100,200,255,0.15)',
                borderRadius: 12,
                padding: 16,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>
                {puzzle.name}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                {puzzle.pieces.length} ピース · {puzzle.board.length} セル · {puzzle.gridType}
              </div>
              {record.totalClears > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                  <span>🏆 {record.bestTimeMs !== null ? formatTime(record.bestTimeMs) : '-'}</span>
                  <span>📋 {record.discoveredSolutionIds.length} 解発見</span>
                  <span
                    onClick={(e) => { e.stopPropagation(); onGallery(puzzle.id) }}
                    style={{ color: 'rgba(100,200,255,0.7)', cursor: 'pointer' }}
                  >
                    解法一覧 →
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: ResultScreen.tsx を実装する**

```tsx
// src/screens/ResultScreen.tsx

type Props = {
  clearTimeMs: number
  solutionId: number
  onPlayAgain: () => void
  onBack: () => void
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  const milli = Math.floor((ms % 1000) / 10)
  return `${m}:${sec.toString().padStart(2, '0')}.${milli.toString().padStart(2, '0')}`
}

export function ResultScreen({ clearTimeMs, solutionId, onPlayAgain, onBack }: Props) {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a1a, #1a2a1a)',
      fontFamily: 'sans-serif',
      color: '#fff',
    }}>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', letterSpacing: 3 }}>CLEAR!</div>
      <div style={{ fontSize: 48, fontWeight: 700, marginTop: 8 }}>{formatTime(clearTimeMs)}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
        解法 #{solutionId}
      </div>
      <div style={{ marginTop: 40, display: 'flex', gap: 16 }}>
        <button
          onClick={onPlayAgain}
          style={{
            padding: '12px 28px', border: '1px solid rgba(100,255,100,0.3)',
            borderRadius: 25, background: 'transparent', color: 'rgba(100,255,100,0.8)',
            fontSize: 14, cursor: 'pointer',
          }}
        >
          もう一度
        </button>
        <button
          onClick={onBack}
          style={{
            padding: '12px 28px', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 25, background: 'transparent', color: 'rgba(255,255,255,0.5)',
            fontSize: 14, cursor: 'pointer',
          }}
        >
          パズル選択
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: ClearAnimation.tsx を実装する**

```tsx
// src/screens/ClearAnimation.tsx
import { useEffect } from 'react'

type Props = {
  onComplete: () => void
}

export function ClearAnimation({ onComplete }: Props) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle, rgba(255,200,50,0.2) 0%, rgba(0,0,0,0.9) 100%)',
      zIndex: 100,
    }}>
      <div style={{
        fontSize: 48,
        fontWeight: 800,
        color: '#f39c12',
        textShadow: '0 0 40px rgba(243,156,18,0.5)',
        animation: 'pulse 1s ease-in-out infinite',
        fontFamily: 'sans-serif',
      }}>
        ✨ COMPLETE ✨
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 5: SolutionGalleryScreen.tsx を実装する**

```tsx
// src/screens/SolutionGalleryScreen.tsx

type Props = {
  puzzleId: string
  discoveredIds: number[]
  onBack: () => void
}

export function SolutionGalleryScreen({ puzzleId, discoveredIds, onBack }: Props) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(135deg, #0d1117, #1a1a2e)',
      padding: 24,
      fontFamily: 'sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent', border: 'none', color: 'rgba(100,200,255,0.7)',
            fontSize: 14, cursor: 'pointer', padding: 0,
          }}
        >
          ← 戻る
        </button>
        <h2 style={{ color: '#fff', fontSize: 16, marginLeft: 16 }}>
          解法一覧（{discoveredIds.length} 件）
        </h2>
      </div>
      {discoveredIds.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 60 }}>
          まだ解法が見つかっていません
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: 12,
          maxWidth: 600,
          margin: '0 auto',
        }}>
          {discoveredIds.map(id => (
            <div
              key={id}
              style={{
                aspectRatio: '1',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(100,200,255,0.1)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 14,
              }}
            >
              #{id}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/screens/
git commit -m "feat: screen components (title, puzzle select, result, gallery, clear animation)"
```

---

## Task 10: GameScreen + ピースインタラクション + App 統合

**Files:**
- Create: `src/screens/GameScreen.tsx`
- Create: `src/three/PieceInteraction.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

### 背景知識

GameScreen は React Three Fiber の Canvas を含む画面コンポーネント。ピースのドラッグ・回転・反転・スナップを PieceInteraction で処理し、gameReducer で状態遷移する。クリア判定が true になったらクリア演出に遷移する。

App.tsx は AppState ユニオン型で画面遷移を管理する。

この Task は大きいため、1ステップずつ慎重に実装する。

- [ ] **Step 1: PieceInteraction.tsx を実装する**

```tsx
// src/three/PieceInteraction.tsx
import { useRef, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { GameAction, Position } from '../game/state'

type Props = {
  pieceId: string
  isMobile: boolean
  onAction: (action: GameAction) => void
}

/**
 * ピースのタッチ/マウスインタラクションを処理するフック。
 * 返り値の handlers を mesh の props に展開する。
 */
export function usePieceInteraction({ pieceId, isMobile, onAction }: Props) {
  const dragRef = useRef(false)
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lastTap = useRef(0)
  const { camera, gl } = useThree()

  const getWorldPosition = useCallback((clientX: number, clientY: number): Position => {
    const rect = gl.domElement.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -((clientY - rect.top) / rect.height) * 2 + 1
    const vec = new THREE.Vector3(x, y, 0).unproject(camera)
    return { x: vec.x, y: vec.y }
  }, [camera, gl])

  const onPointerDown = useCallback((e: THREE.Event) => {
    e.stopPropagation()
    const event = e as unknown as PointerEvent
    startPos.current = { x: event.clientX, y: event.clientY }
    dragRef.current = false
  }, [])

  const onPointerMove = useCallback((e: THREE.Event) => {
    const event = e as unknown as PointerEvent
    const dx = event.clientX - startPos.current.x
    const dy = event.clientY - startPos.current.y
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragRef.current = true
    }
    if (dragRef.current) {
      const pos = getWorldPosition(event.clientX, event.clientY)
      const offset = isMobile ? 40 : 0
      onAction({
        type: 'move',
        pieceId,
        position: { x: pos.x, y: pos.y + offset },
        timestamp: Date.now(),
      })
    }
  }, [pieceId, isMobile, getWorldPosition, onAction])

  const onPointerUp = useCallback((e: THREE.Event) => {
    if (!dragRef.current) {
      // タップ判定
      const now = Date.now()
      if (now - lastTap.current < 300) {
        // ダブルタップ → 反転
        onAction({ type: 'flip', pieceId, timestamp: now })
        lastTap.current = 0
      } else {
        // シングルタップ → 回転
        lastTap.current = now
        setTimeout(() => {
          if (lastTap.current === now) {
            onAction({ type: 'rotate', pieceId, timestamp: now })
          }
        }, 300)
      }
    }
    dragRef.current = false
  }, [pieceId, onAction])

  return { onPointerDown, onPointerMove, onPointerUp }
}
```

- [ ] **Step 2: GameScreen.tsx を実装する**

```tsx
// src/screens/GameScreen.tsx
import { useReducer, useCallback, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import type { PuzzleDef } from '../core/puzzle'
import { GRID_OPS } from '../core/grid-ops'
import { initGameState, gameReducer } from '../game/state'
import type { GameAction, GameState } from '../game/state'
import { getOrientedCells, getPlacedCells, gridToWorld } from '../game/placement'
import { findSnapPosition } from '../game/snap'
import { checkCleared } from '../game/clear-check'
import { cellKey } from '../core/grid'
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
  // ペントミノ/テトロミノ用（追加分）
  L: '#ff6b6b', N: '#4ecdc4', T: '#45b7d1', U: '#96ceb4',
  W: '#ffeaa7', Y: '#dfe6e9', Z: '#a29bfe', R: '#fd79a8',
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

  // タイマー
  useEffect(() => {
    if (!state.startedAt) {
      dispatch({ type: 'start', timestamp: Date.now() })
      return
    }
    const interval = setInterval(() => {
      setElapsed(Date.now() - state.startedAt!)
    }, 100)
    return () => clearInterval(interval)
  }, [state.startedAt])

  // アクションハンドラ（サウンド付き）
  const handleAction = useCallback((action: GameAction) => {
    dispatch(action)
    switch (action.type) {
      case 'move': soundEngine.playClick(); break
      case 'rotate': soundEngine.playRotate(); break
      case 'flip': soundEngine.playFlip(); break
      case 'snap': soundEngine.playSnap(); break
    }
  }, [soundEngine])

  // クリア判定
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
    <div style={{ width: '100vw', height: '100dvh', position: 'relative', background: darkMode ? '#0a0a1a' : '#e8e0d8' }}>
      {/* タイマー */}
      <div style={{
        position: 'absolute', top: 12, left: 16, zIndex: 10,
        color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
        fontSize: 16, fontFamily: 'monospace',
      }}>
        {formatTime(elapsed)}
      </div>
      {/* Three.js Canvas */}
      <Canvas style={{ width: '100%', height: '100%' }}>
        <OrthographicCamera makeDefault position={[0, 0, 50]} zoom={1} />
        <Lighting darkMode={darkMode} />
        <BoardMesh cells={puzzle.board} cellSize={CELL_SIZE} gridType={puzzle.gridType} />
        {state.pieces.map(ps => {
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
```

注: この実装は初期版。PieceInteraction のフック統合、初期配置のランダム散乱、ドラッグ中のオフセット表示は反復的に追加する。

- [ ] **Step 3: App.tsx を書き換える（画面遷移統合）**

```tsx
// src/App.tsx
import { useState, useCallback, useEffect } from 'react'
import { PUZZLES } from './data/puzzles'
import { TitleScreen } from './screens/TitleScreen'
import { PuzzleSelectScreen } from './screens/PuzzleSelectScreen'
import { GameScreen } from './screens/GameScreen'
import { ClearAnimation } from './screens/ClearAnimation'
import { ResultScreen } from './screens/ResultScreen'
import { SolutionGalleryScreen } from './screens/SolutionGalleryScreen'
import { SoundEngine } from './audio/sound'
import { GameStorage } from './storage/db'
import type { PuzzleRecord } from './storage/db'
import type { GameState } from './game/state'

type AppState =
  | { screen: 'title' }
  | { screen: 'puzzle-select' }
  | { screen: 'game'; puzzleId: string }
  | { screen: 'clear-animation'; puzzleId: string; clearTimeMs: number; solutionId: number; gameState: GameState }
  | { screen: 'result'; puzzleId: string; clearTimeMs: number; solutionId: number }
  | { screen: 'solution-gallery'; puzzleId: string }

const soundEngine = new SoundEngine(false)
const storage = new GameStorage()

export default function App() {
  const [appState, setAppState] = useState<AppState>({ screen: 'title' })
  const [records, setRecords] = useState<Map<string, PuzzleRecord>>(new Map())

  // パズル成績をロード
  const loadRecords = useCallback(async () => {
    const map = new Map<string, PuzzleRecord>()
    for (const p of PUZZLES) {
      map.set(p.id, await storage.getPuzzleRecord(p.id))
    }
    setRecords(map)
  }, [])

  useEffect(() => { loadRecords() }, [loadRecords])

  // サウンド設定をロード
  useEffect(() => {
    storage.getSoundEnabled().then(enabled => soundEngine.setEnabled(enabled))
  }, [])

  const handleClear = useCallback(async (gameState: GameState, clearTimeMs: number) => {
    const solutionId = 0  // TODO: 解法マッチング（解法データ生成後に実装）
    setAppState({
      screen: 'clear-animation',
      puzzleId: gameState.puzzleId,
      clearTimeMs,
      solutionId,
      gameState,
    })
  }, [])

  const handleClearAnimationComplete = useCallback(async () => {
    if (appState.screen !== 'clear-animation') return
    const { puzzleId, clearTimeMs, solutionId, gameState } = appState
    await storage.saveClear({
      puzzleId,
      solutionId,
      clearTimeMs,
      actions: gameState.actions,
      clearedAt: new Date().toISOString(),
    })
    await loadRecords()
    setAppState({ screen: 'result', puzzleId, clearTimeMs, solutionId })
  }, [appState, loadRecords])

  switch (appState.screen) {
    case 'title':
      return <TitleScreen onStart={() => setAppState({ screen: 'puzzle-select' })} />

    case 'puzzle-select':
      return (
        <PuzzleSelectScreen
          puzzles={PUZZLES}
          records={records}
          onSelect={id => setAppState({ screen: 'game', puzzleId: id })}
          onGallery={id => setAppState({ screen: 'solution-gallery', puzzleId: id })}
        />
      )

    case 'game': {
      const puzzle = PUZZLES.find(p => p.id === appState.puzzleId)!
      return (
        <GameScreen
          puzzle={puzzle}
          soundEngine={soundEngine}
          onClear={handleClear}
        />
      )
    }

    case 'clear-animation':
      return <ClearAnimation onComplete={handleClearAnimationComplete} />

    case 'result':
      return (
        <ResultScreen
          clearTimeMs={appState.clearTimeMs}
          solutionId={appState.solutionId}
          onPlayAgain={() => setAppState({ screen: 'game', puzzleId: appState.puzzleId })}
          onBack={() => setAppState({ screen: 'puzzle-select' })}
        />
      )

    case 'solution-gallery': {
      const record = records.get(appState.puzzleId) ?? {
        bestTimeMs: null, discoveredSolutionIds: [], totalClears: 0,
      }
      return (
        <SolutionGalleryScreen
          puzzleId={appState.puzzleId}
          discoveredIds={record.discoveredSolutionIds}
          onBack={() => setAppState({ screen: 'puzzle-select' })}
        />
      )
    }
  }
}
```

- [ ] **Step 4: index.html のタイトルを更新**

`index.html` の `<title>` を `Polyform Packing Puzzle` に変更。

- [ ] **Step 5: dev server で動作確認**

```bash
npm run dev
```

ブラウザで `http://localhost:5173/plapazzle/` を開き:
1. タイトル画面が表示される
2. タップでパズル選択画面に遷移
3. パズルを選択するとゲーム画面が表示される（ボードが3Dで描画される）

- [ ] **Step 6: Commit**

```bash
git add src/screens/GameScreen.tsx src/three/PieceInteraction.tsx src/App.tsx index.html
git commit -m "feat: game screen with Three.js canvas + App screen navigation"
```

---

## Task 11: ピースの初期配置 + ドラッグ操作統合

**Files:**
- Modify: `src/screens/GameScreen.tsx`
- Modify: `src/game/state.ts`

### 背景知識

ゲーム開始時にピースをボード周囲にランダムに散乱させる。ドラッグ操作と PieceInteraction フックを GameScreen に統合する。ドラッグ中はモバイルで上方40pxオフセット + 1.2倍拡大。

- [ ] **Step 1: initGameState にランダム初期配置を追加**

`src/game/state.ts` の `initGameState` を修正して、ピースをボード周囲に配置する:

```typescript
// initGameState 内に追加
// ボードの重心を計算
const boardCenter = { x: 0, y: 0 }  // GameScreen で実座標を設定
// ピースをボード周囲の円上にランダムに配置
const radius = 200  // ボード外周からの距離
const angleStep = (2 * Math.PI) / puzzle.pieces.length
pieces.forEach((p, i) => {
  const angle = angleStep * i + (Math.random() - 0.5) * 0.5
  p.position = {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }
})
```

- [ ] **Step 2: GameScreen にドラッグ操作を統合**

GameScreen で各 PieceMesh に onPointerDown/Move/Up ハンドラを設定し、ドラッグ中のオフセットとスケールを適用する。ドロップ時に `findSnapPosition` を呼び出し、有効なら `snap` アクションを dispatch する。

- [ ] **Step 3: dev server で動作確認**

1. ゲーム画面でピースが周囲にランダム配置される
2. ピースをドラッグして移動できる
3. タップで回転、ダブルタップで反転
4. ボード近くでドロップするとスナップする
5. 全ピース配置でクリア演出 → 結果画面

- [ ] **Step 4: Commit**

```bash
git add src/screens/GameScreen.tsx src/game/state.ts
git commit -m "feat: piece interaction - drag, rotate, flip, snap"
```

---

## Task 12: サウンドトグル + 最終調整

**Files:**
- Modify: `src/screens/GameScreen.tsx`（サウンドトグルUI追加）
- Modify: `src/App.tsx`（サウンド設定の永続化）
- Run: 全テスト + ビルド確認

- [ ] **Step 1: GameScreen にサウンドトグルを追加**

画面右上に SOUND ON/OFF トグルスイッチを配置。クリック/タップで切り替え、状態を IndexedDB に保存。

- [ ] **Step 2: 全テスト実行**

```bash
npm test
```

Expected: 全テスト PASS

- [ ] **Step 3: ビルド確認**

```bash
npm run build
```

Expected: ビルド成功

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: sound toggle + final adjustments"
```
