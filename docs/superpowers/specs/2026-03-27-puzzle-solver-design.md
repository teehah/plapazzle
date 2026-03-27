# プラパズル No.6 ソルバ 設計ドキュメント

**日付**: 2026-03-27
**対象**: プラパズル No.6（テンヨー）ソルバ
**フェーズ**: Phase 1 = No.6専用、Phase 2 = 汎用化

---

## 概要

テンヨーの「プラパズル No.6」をブラウザ上で解くソルバ。
三角グリッド（ポリアモンド）上のパッキングパズルを Exact Cover / Dancing Links (DLX) で全解列挙し、React + SVG で可視化する。

対象パズル: [プラパズルの部屋（高知大学 塩田ページ）](http://lupus.is.kochi-u.ac.jp/shiota/misc/puzzle/puzzle.html)

---

## 技術スタック

| 項目 | 採用 |
|---|---|
| 言語 | TypeScript |
| フレームワーク | React + Vite |
| スタイル | CSS Modules（最小限） |
| テスト | Vitest |
| ビルド | Vite |

---

## アーキテクチャ

### ディレクトリ構成

```
pazzle/
├── src/
│   ├── core/
│   │   ├── grid.ts       # 三角グリッド座標系・ユーティリティ
│   │   ├── piece.ts      # ピース定義・回転・反転・正規化
│   │   ├── board.ts      # ボード形状定義・セルリスト生成
│   │   ├── dlx.ts        # Dancing Links (Knuth's Algorithm X)
│   │   └── solver.ts     # パズル→Exact Cover変換・解の復元
│   ├── data/
│   │   └── no6.ts        # No.6のピース・ボード定義（ハードコード）
│   ├── ui/
│   │   ├── App.tsx       # ルート・解リストのstate管理
│   │   ├── Board.tsx     # SVGによる三角グリッド描画
│   │   └── Controls.tsx  # Solveボタン・解ナビゲーション
│   ├── worker/
│   │   └── solver.worker.ts  # WebWorker: DLX実行をバックグラウンド化
│   └── main.tsx
├── src/core/__tests__/
│   ├── dlx.test.ts       # DLXユニットテスト
│   └── solver.test.ts    # No.6統合テスト（既知解数の確認）
├── package.json
├── vite.config.ts
└── index.html
```

### データフロー

```
no6.ts (ピース・ボード定義)
  → solver.ts (Exact Cover行列に変換)
    → dlx.ts (全解を列挙) ← WebWorker上で実行
      → App.tsx (solutions[] stateに格納)
        → Board.tsx (SVG描画)
```

---

## 三角グリッド座標系

### セル識別子

```ts
type Cell = { row: number; col: number; dir: 0 | 1 };
// dir=0: 上向き△, dir=1: 下向き▽
```

グリッドのイメージ:
```
col:  0   1   2
row0: △▽ △▽ △▽
row1: △▽ △▽ △▽
```

### 隣接関係（各セルの3辺）

| セルの向き | 隣1 | 隣2 | 隣3 |
|---|---|---|---|
| △ (dir=0) | (r, c-1, 1) | (r, c, 1) | (r-1, c, 1) |
| ▽ (dir=1) | (r, c, 0) | (r, c+1, 0) | (r+1, c, 0) |

### SVG座標への変換

セルサイズを `H`（三角形の高さ）、`W = H * 2 / √3`（底辺）として:

```ts
// △ (dir=0) の3頂点
[(col * W/2,       (row+1) * H),
 ((col+1) * W/2,   row * H),
 ((col+2) * W/2,   (row+1) * H)]

// ▽ (dir=1) の3頂点
[(col * W/2,       row * H),
 ((col+2) * W/2,   row * H),
 ((col+1) * W/2,   (row+1) * H)]
```

### ピースの変換（回転・反転）

- 回転: 60°× 6段階 → 変換行列 `(r,c,d) → (r',c',d')`
- 反転: 左右ミラー（1段階）
- 最大12向き（回転6 × 反転2）
- 各向きを生成後、`(row,col)` が最小になるよう正規化（平行移動）してキャッシュ

---

## DLX / Exact Cover

### 列構成

```
[piece_0_used, ..., piece_K_used,  cell_0, ..., cell_N]
```

- **ピース列**（K個）: 各ピースをちょうど1回使う制約
- **セル列**（N個）: 各ボードセルをちょうど1回カバーする制約

### 行の意味

「ピース P を向き O で、ボード上の位置 (r,c) 起点に置く」という1配置 = 1行。
その行がカバーする列:
- `piece_P_used`
- 配置が占める全セルのインデックス

### DLX インターフェース

```ts
// dlx.ts
export function solveExactCover(
  numCols: number,
  rows: number[][],  // 各行がカバーする列インデックスのリスト
  onSolution: (selectedRows: number[]) => void
): void;
```

### WebWorker

UIスレッドのブロックを防ぐため、`solver.worker.ts` 上で DLX を実行。
全解が出揃ったら `postMessage({ solutions })` でメインスレッドへ送信。

---

## Web UI

### 画面レイアウト

```
┌─────────────────────────────────┐
│  プラパズル No.6 ソルバ           │
├─────────────────────────────────┤
│                                 │
│      [SVG ボード描画]            │
│   （各ピースを色分けして表示）     │
│                                 │
├─────────────────────────────────┤
│  [Solve]  解: 3/12  [←] [→]    │
│  ピース: 6個  セル: 24           │
└─────────────────────────────────┘
```

### 状態管理（App.tsx）

```ts
const [solutions, setSolutions] = useState<Solution[]>([]);
const [index, setIndex] = useState(0);
const [status, setStatus] = useState<'idle' | 'solving' | 'done'>('idle');
```

### Board.tsx

- 各セル = SVG `<polygon>`
- ピースIDに基づき固定の6色を割り当て
- ボード外枠を `<path>` で強調
- ピース間境界線を太く、グリッド線を細く表示

---

## データ定義（no6.ts）

```ts
// ピース: セルのオフセットリスト（正規化済み）
export type PieceDef = { id: string; cells: Cell[] };

// ボード: 有効セルのリスト
export type BoardDef = { cells: Cell[] };
```

No.6のピース形状は実物確認・画像解析で実装時に確定する（制約: ピース全セル数合計 = ボードセル数）。

---

## エラー処理

| 状況 | 処理 |
|---|---|
| ピース全セル数合計 ≠ ボードセル数 | `solver.ts` 起動時に Error を throw |
| 解なし | Controls に「解なし」を表示 |
| WebWorker エラー | `status = 'error'` にしてコンソールにログ |

---

## テスト

| テスト | 内容 |
|---|---|
| `dlx.test.ts` | 小さい既知Exact Cover問題で解が正しく列挙されることを確認 |
| `solver.test.ts` | No.6の解の総数が既知の値と一致することを確認 |

---

## 将来の汎用化（Phase 2）

- `no6.ts` の形式をそのまま `puzzles/no6.json` などのJSONファイルにする
- UIに「パズル選択」ドロップダウンを追加
- 正方形グリッド（No.5ペントミノ等）にも対応できるよう `grid.ts` を抽象化
- ピース定義をUIから入力できるエディタ機能（オプション）
