# プラパズル No.6 ソルバ

プラパズル No.6（Tenyo / ヘキサモンドパズル）の全解をブラウザ上で列挙・可視化するソルバ。

12種のヘキサモンド（正三角形6枚を辺で繋いだ形）を、72セルの不規則六角形ボードに隙間なく敷き詰める。全9,936解（対称性を除くと4,968解）を Dancing Links (DLX) で列挙する。

## デモ

https://teehah.github.io/plapazzle/

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
