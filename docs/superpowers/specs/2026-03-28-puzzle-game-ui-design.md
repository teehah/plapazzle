# パッキングパズル ゲームUI 設計書

## 概要

ポリフォーム・パッキングパズル（ヘキサモンド、ペントミノ等）をブラウザ上で遊べるインタラクティブなゲームUIを構築する。実物のプラスチック製パズルを模した3Dレンダリングで、ピースをドラッグ&ドロップして枠に敷き詰める体験を提供する。

## 画面遷移

```
アプリタイトル → パズル選択 → ゲーム → クリア演出 → 結果
                    ↑                       ↓もう一度 → ゲーム
                    ↑                       ↓戻る → パズル選択
                    ↓
                 解法一覧（クリア済みパズルのみ）
```

### 各画面の責務

| 画面 | 内容 |
|------|------|
| アプリタイトル | ブランドロゴ + "TAP TO START"。ミニマルデザイン。暗い背景にガラス質のパズルが浮かぶ。 |
| パズル選択 | カードリスト。各カードにパズル名・グリッド種類・ピース数・ボードサイズ・ベストタイム・発見解数を表示。クリア済みパズルには「解法一覧」リンクを表示。 |
| ゲーム | ボード中央固定、ピースが周囲にランダム散乱。タイマー表示。SOUND ON/OFFトグル。 |
| クリア演出 | 全画面エフェクト + ファンファーレ音。完成したパズルが光り輝く演出。数秒後に結果画面へ自動遷移。 |
| 結果 | クリアタイム・解法ID・「もう一度遊ぶ」「パズル選択に戻る」ボタン。 |
| 解法一覧 | 発見済み解法のサムネイルをグリッド表示。タップで拡大表示。 |

## 3Dレンダリング

### 技術

React Three Fiber (Three.js) を使用。

### ビジュアルスタイル

システムのカラースキームに連動して2パターン:

- **ライトモード**: ライトテーブルスタイル。明るいテーブル背景。自然光。実物のプラパズルに近い。柔らかい影。
- **ダークモード**: スポットライトスタイル。暗い背景。上方からのスポットライト。ガラス表面の反射と屈折によるコースティクス。ピースが宝石のように輝く。

`prefers-color-scheme` メディアクエリで自動切替。

### カメラ

真上からの正射影（OrthographicCamera）。2Dの見た目に近いが、3Dの質感（影、表面反射、屈折、光の透過）で美しさを表現する。

### マテリアル

- **ボード（枠）**: 透明なガラス状。MeshPhysicalMaterial: transmission=0.9, roughness=0.1, ior=1.5, thickness=2。無色。
- **ピース**: 各ピース異なる色の透過ガラス状。MeshPhysicalMaterial: transmission=0.7, roughness=0.15, ior=1.45, thickness=1.5。12色（PIECE_COLORSから流用）。
- **ライティング**:
  - ライトモード: AmbientLight(強め) + DirectionalLight(上方、影あり)
  - ダークモード: AmbientLight(弱め) + SpotLight(上方、コースティクス風の影)

### ジオメトリ

各三角形セルは ExtrudeGeometry で薄い三角柱として表現（高さ2-3px相当の厚み）。ピースは6つの三角柱をマージした単一ジオメトリ。エッジにわずかなベベル（bevelSize=0.3）をつけてガラスのリアリティを出す。

正方形グリッドの場合は正方形セルの角柱。

## ピース操作（モバイルファースト）

### タッチ操作

| 操作 | 効果 |
|------|------|
| タップ | 固定角度で時計回り回転（三角グリッド:60°、正方形グリッド:90°） |
| ダブルタップ | ミラー反転（裏返し） |
| ドラッグ | ピースを移動（枠の内外どこでも配置可能） |
| ボード近くでドロップ | グリッドにスナップフィット |

### ドラッグ中の表示

- ピースをタッチ位置の**上方40px**にオフセット表示（指で隠れない）
- ドラッグ中はピースを**1.2倍に拡大**して強調
- ドラッグ中はピースに**ドロップシャドウ**を追加（持ち上がった感）
- スナップ可能な位置に近づいたら、スナップ先をハイライト表示

### PC操作（マウス）

| 操作 | 効果 |
|------|------|
| クリック | 固定角度で時計回り回転 |
| 右クリック or Shift+クリック | ミラー反転 |
| ドラッグ | ピースを移動 |
| ホイール | 回転（オプション） |

マウスの場合はオフセット不要（カーソルが小さいため）。

### スナップフィット

ピースのドロップ位置がボードセルの中心から一定距離（セルサイズの50%）以内の場合、最も近い有効位置にスナップする。有効位置 = ピースの全セルがボード内に収まり、かつ他のピースと重ならない位置。

## サウンド

Web Audio API でプログラム生成。デフォルトOFF。画面上のトグルスイッチでON/OFF切替。

| イベント | サウンド |
|---------|---------|
| ピース移動 | 小さなカチッ音（短いクリック、200Hz、50ms） |
| ピース回転 | カチカチ音（やや高め、400Hz、30ms） |
| ピース反転 | パタッ音（低め、150Hz + 300Hz、80ms） |
| スナップフィット | パチッ音（やや大きめ、500Hz + 1000Hz、100ms） |
| クリア | ファンファーレ（上昇音階 C-E-G-C、各200ms、正弦波） |

## ゲームロジック

### 初期化

1. 選択されたパズルの `PuzzleDef` からボードとピースを取得
2. ボードを画面中央に固定配置
3. 全ピースをランダムな位置・回転でボード周囲に配置
   - ピース同士が重ならないよう配置
   - ボード領域と重ならないよう配置
4. タイマー開始

### クリア判定

全ピースがボード上に配置され、全ボードセルがちょうど1つのピースで覆われている状態。ピースがボード外にはみ出していないこと。

配置のたびにチェック:
1. 全12ピースがボード上に配置されているか
2. ボードの全72セル（No.6の場合）が埋まっているか
3. 重複がないか

### 解法マッチング

クリア時にユーザの配置をビルド時生成の解法データと照合し、解法IDを特定する。（解法データの生成は別タスク: `docs/solution-compression-spec.md` 参照）

## 永続化

IndexedDB を使用。

### ストア構成

```typescript
// パズルごとの成績
interface PuzzleRecord {
  puzzleId: string          // 'no6', 'pentomino-6x10', etc.
  bestTimeMs: number | null
  discoveredSolutionIds: number[]
  totalClears: number
}

// 個別のクリア記録
interface ClearRecord {
  id: string                // auto-generated
  puzzleId: string
  solutionId: number
  clearTimeMs: number
  actions: GameAction[]     // リプレイ用手順
  clearedAt: string         // ISO 8601
}

// 設定
interface AppSettings {
  soundEnabled: boolean
}
```

### GameAction（リプレイ用）

```typescript
type GameAction = {
  type: 'place' | 'rotate' | 'flip' | 'move' | 'pickup' | 'drop'
  pieceId: string
  position: { x: number; y: number }  // ワールド座標
  orientation: number                  // uniqueOrientations() のインデックス
  timestamp: number                    // ゲーム開始からのms
}
```

## コンポーネント構成

```
App
├── TitleScreen
├── PuzzleSelectScreen
│   └── PuzzleCard (×N)
├── GameScreen
│   ├── ThreeCanvas (React Three Fiber)
│   │   ├── BoardMesh
│   │   ├── PieceMesh (×12)
│   │   ├── Lighting
│   │   └── Camera (OrthographicCamera)
│   ├── TimerDisplay
│   └── SoundToggle
├── ClearAnimation
├── ResultScreen
└── SolutionGalleryScreen
    └── SolutionThumbnail (×N)
```

### 状態管理

React の useState/useReducer で管理。外部ライブラリ不使用。

```typescript
type AppState =
  | { screen: 'title' }
  | { screen: 'puzzle-select' }
  | { screen: 'game'; puzzleId: string }
  | { screen: 'clear-animation'; puzzleId: string; clearTimeMs: number; solutionId: number }
  | { screen: 'result'; puzzleId: string; clearTimeMs: number; solutionId: number }
  | { screen: 'solution-gallery'; puzzleId: string }
```

## 技術スタック追加

既存の React + Vite + TypeScript に以下を追加:

| パッケージ | 用途 |
|-----------|------|
| `@react-three/fiber` | React Three Fiber（Three.js の React バインディング） |
| `@react-three/drei` | Three.js ヘルパー（OrthographicCamera, Environment 等） |
| `three` | Three.js 本体 |
| `idb-keyval` | IndexedDB の簡易ラッパー |

## スコープ外

- マルチプレイ / オンラインランキング
- パズルエディタ（ユーザ定義パズル）
- リプレイ再生機能（データは保存するが再生UIは後日）
- Service Worker / オフライン対応
- i18n（日本語のみ）
