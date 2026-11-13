# 3D 標準対応 P0 スパイク（検証用・マージしない）

計画: Claude project の `plans/3d-core-major.md`（§6 P0）、追跡 Issue #1304。
ここのスクリプトは結果を出すためだけのもので、main には入れない。`apps/web/src/app.tsx` の `spike-3d-p0` プラグイン（`window.__spike3d` / `window.__spikeExport`）も、このブランチの計測用の仕掛け。

実行: リポジトリのルートで `pnpm install`、`pnpm --filter "@edv4h/usketch-web^..." -r run build`、`apps/web` で `npx vite --port 4578 --strictPort` を立ててから、各ディレクトリの `node run.cjs`。

## (c) 投影の 3 つの写しは一致するか — `projection/`

mode7 の CSS（`tiltTransform` ＋ カメラの高さの `translateZ`）をブラウザに描かせて測った位置、mode7 の `projectToGround`、elevation の `projectLifted`、elevation の本物の頂点シェーダー（transform feedback で `gl_Position` を取り出す）を、4 つのカメラ × 高さ 3 つ × 約 100 点で比べた。

| 比べたもの | 画面内の最大のずれ |
|---|---|
| `projectToGround` と `projectLifted` | 0（同じ式） |
| TS と CSS（ブラウザの実測） | 0.03〜0.15 px（CSS の値の丸めと測り方の誤差） |
| TS と GLSL | 0.0002〜0.0009 px（ズーム 2.5・回転 37° でも同じ） |

結論: **今の写しはずれていない**。P1 でコアの 1 つの関数にまとめても絵は変わらない。画面のすぐ外（目の直前で 40 倍以上に拡大される点）では float32 の丸めだけで数 px ずれるので、比較は画面とその周りに限る。このスクリプトは P1 の回帰テストの土台にする（CSS・GL・TS が同じ点を返すこと）。

## (a) yaw を viewport の rotation に一本化できるか — `yaw/`

式の上では、`yaw = Y`・viewport `(t, rot)` と、`yaw = 0`・viewport `(O + Rz(Y)(t − O), rot + Y)`（O は傾ける軸 = `(W/2, H·horizon)`）は同じ絵になる。実アプリ（elevation の地形 ＋ Shape 25 個 ＋ shape-3d の stand（camera / fixed）と box）で、両方を描いてスクリーンショットを層ごとに比べた（yaw 35°）。

| 層 | 差（しきい値を超えた画素） |
|---|---|
| bg-grid / bg-dots / dom-shapes / elevation の 2D / 空・霧 ほか | 0% |
| shape-3d（stand camera・stand fixed・box・地形に乗る平らな Shape） | 0.7%（輪郭のアンチエイリアスだけ。形・向きは同じ） |
| elevation のメッシュ | 3.2%（地平線ぎわの、描く範囲の端だけ） |

結論: **一本化できる**。違いは 2 つだけ。

1. 描く範囲（描画距離の `clip-path` とメッシュのタイル）は「傾ける前の画面の箱」で決まるので、yaw のときは箱が地面ごと回り、rotation のときは画面に揃う。rotation の方が地面の奥の端が地平線と平行になり、むしろ自然。
2. **挙動の違い**: 今の yaw は 3D のときだけ効き、平面に戻すと向きが元に戻る。rotation は 2D にも残る。一本化するなら、mode7 は「3D に入ったときの rotation を覚えて、出るときに戻す（遷移アニメで一緒に回す）」必要がある。キャラの追従カメラ（`rotate`）はもともと rotation を使っているので、そのまま。

## (b) depth 層を 1 つの preserve-3d にまとめる — `depth-stage/`

`bench.html` は単体で開けるページ。崖（箱）・看板（stand）・キャラを、今のように層ごとに別の 3D 文脈で描く場合と、1 つの `preserve-3d` にまとめる場合を切り替え、前後関係のチェック（看板のすぐ後ろのキャラが隠れるか）と、カメラを回し続けたときのフレーム時間を測る。

- **前後関係**: まとめると正しく隠れる（看板が崖の後ろに、キャラが看板の後ろに隠れる）。層ごとだと必ず後の層が手前に出る。60 / 300 / 900 個のどれでも同じ。
- **性能**: ここ（ヘッドレスの Chromium）はソフトウェア描画なので、数字は実機の GPU と違う（300 個で 50〜70 ms、900 個は数百 ms〜秒）。実機の Chrome と Safari で `bench.html` の「全部まとめて計測」を押して確かめる。

## (d) GPU レンダラーで DOM の Shape を画像にする道 — `rasterize/`

書き出しの `exportRegion`（Satori / SVG → PNG）で Shape 1 つを画像にする時間（ヘッドレス Chromium、pixelRatio 2、12 回の中央値）。

| 種別 | 描き方 | 1 つあたり |
|---|---|---|
| rectangle / ellipse | svg | 約 17 ms |
| sticky / text / markdown / image / card / wireframe-card | html（Satori） | 約 220〜250 ms |

結論: **html の Shape を書き出しの道で画像にするのは遅すぎる**（付箋 300 枚で 1 分以上）。GPU レンダラー（P6g）は、最初に別の道（DOM をそのまま SVG の `foreignObject` に入れて画像にする、近いものから 1 フレームあたりの予算内で作る、できるまでは代わりの絵）を試して測る。
