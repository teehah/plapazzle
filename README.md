# ポリフォーム パッキングパズル ソルバ

ヘキサモンド・ペントミノ等のパッキングパズルの全解をブラウザ上で列挙・可視化するソルバ。

ポリフォーム（正多角形を辺で繋いだピース）をボードに隙間なく敷き詰めるパズルを Dancing Links (DLX) で解く。

## デモ

https://teehah.github.io/plapazzle/

## 対応パズル

| パズル | グリッド | ピース | ボード |
|---|---|---|---|
| ヘキサモンド 72セル | 三角形 | 12 × 6セル | 不規則六角形 |

## 使い方

「Solve」ボタンを押すと WebWorker 上で全解を計算し、完了後に `←` / `→` で解を切り替えて表示できる。

## 技術スタック

- TypeScript / React / Vite
- SVG（三角グリッド描画）
- Dancing Links（Knuth's Algorithm X）
- WebWorker（UIブロッキング回避）

## 座標系

puzzler.sourceforge.net の Triangular3D 座標系を採用。各セルは `{ row, col, dir }` で表現される（`dir=0`: △、`dir=1`: ▽）。SVG 描画では斜交座標系（60°）を使用。

## ローカル開発

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 全38テスト実行（ソルバテストに約30秒）
npm run build    # 静的ファイル生成
```

## ライセンス

MIT
