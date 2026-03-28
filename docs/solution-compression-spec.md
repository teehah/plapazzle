# 解法データ圧縮仕様

## 概要

ビルド時に全9,936解を算出し、圧縮してstatic JSONとして配信する。クリア時は解法IDを保存するのみ。

## 圧縮戦略

### Step 1: 対称性削減（9,936 → 4,968）

No.6ボードは180°回転対称。全解の半分は他の半分の回転像なので、正規化した4,968解のみを保存する。

- 各解を180°回転した解と比較し、辞書順で小さい方を「正規解」として採用
- 正規解にID 0〜4,967 を付与
- 回転像の解は `id + 4968` でIDを算出可能

### Step 2: ピースベース encoding（72byte → 15byte/解）

セルベース（72セル × pieceId）ではなく、12ピースの配置で表現:

```typescript
type PackedPlacement = {
  pieceId: number     // 0-11 (4bit)
  orientation: number // 0-11 (4bit) — uniqueOrientations() のインデックス
  offsetRow: number   // 0-6  (3bit)
  offsetCol: number   // 0-7  (3bit)
}
// 合計 14bit/ピース × 12ピース = 168bit = 21byte/解
// ピース順を固定すれば pieceId 省略可 → 10bit × 12 = 120bit = 15byte/解
```

ピース順は PIECES 配列の定義順（I,O,X,C,E,P,F,V,S,J,H,G）で固定。各ピースの値は `orientation << 6 | row << 3 | col` の1バイトで格納可能（orientation 0-11, row 0-6, col 0-7）。

### Step 3: バイナリ化

```
ファイルフォーマット: solutions.bin
- ヘッダ: マジックナンバー(4byte) + 解数(2byte)
- ボディ: 各解 12byte (12ピース × 1byte)
  - 各byte: orientation(上位4bit) | row(bit5-3) | col(bit2-0)
合計: 6 + 4968 × 12 = 59,622byte ≈ 58KB
```

### Step 4: 静的圧縮

Vite のビルド出力に brotli 圧縮をかける。バイナリデータの brotli 圧縮で推定 **10-20KB**。

## ビルドスクリプト

`scripts/generate-solutions.ts` を作成:

1. `buildAndSolve()` で全9,936解を列挙
2. 180°回転による正規化で4,968解に削減
3. 各解をピースベースに変換（orientation index + offset）
4. バイナリファイル `public/solutions.bin` として出力

```bash
# package.json scripts に追加
"generate:solutions": "tsx scripts/generate-solutions.ts"
"prebuild": "npm run generate:solutions"
```

## ランタイム（クライアント側）

```typescript
// 解法データのロードと展開
async function loadSolutions(): Promise<Solution[]> {
  const res = await fetch('/plapazzle/solutions.bin')
  const buf = await res.arrayBuffer()
  return decodeSolutions(buf)
}

// 解法マッチング: ユーザ配置 → 解法ID
function matchSolution(userPlacement: Solution): number | null {
  // ユーザ配置をピースベースに変換し、正規化した上で全解と比較
  // 一致すればそのIDを返す（回転像なら id + 4968）
}
```

## クリア手順の保存

```typescript
type GameAction = {
  type: 'place' | 'rotate' | 'flip' | 'move'
  pieceId: string
  position: { row: number; col: number }
  orientation: number  // uniqueOrientations() のインデックス
  timestamp: number    // ゲーム開始からのms
}

type ClearRecord = {
  solutionId: number
  clearTimeMs: number
  actions: GameAction[]
  clearedAt: string  // ISO 8601
}
```

IndexedDB の `clearRecords` ストアに保存。キーは `solutionId`。

## 未決事項

- 差分エンコーディング（Step 2.5）は効果測定後に検討
- solutions.bin のキャッシュ戦略（Service Worker or HTTP cache）
